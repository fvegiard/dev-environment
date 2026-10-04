# input-helper.ps1 — persistent OS-level input injector (SendInput).
# Reads one JSON command per line from stdin and injects it into the OS.
# Commands:
#   {"type":"move","x":1234,"y":567}                 absolute screen coords
#   {"type":"click","button":"left|right|middle","down":true|false}
#   {"type":"wheel","delta":120}
#   {"type":"key","vk":13,"up":false}
#   {"type":"text","text":"hello"}                   Unicode chars (no VK mapping needed)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NativeInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)]
  public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT { public uint type; public INPUTUNION U; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] p, int cb);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@

$MOUSEEVENTF_LEFTDOWN   = 0x0002
$MOUSEEVENTF_LEFTUP     = 0x0004
$MOUSEEVENTF_RIGHTDOWN  = 0x0008
$MOUSEEVENTF_RIGHTUP    = 0x0010
$MOUSEEVENTF_MIDDLEDOWN = 0x0020
$MOUSEEVENTF_MIDDLEUP   = 0x0040
$MOUSEEVENTF_WHEEL      = 0x0800
$KEYEVENTF_KEYUP        = 0x0002
$KEYEVENTF_UNICODE      = 0x0004

function Send-Mouse([uint32]$flags, [int]$dx, [int]$dy, [uint32]$data) {
  $mi = New-Object NativeInput+MOUSEINPUT
  $mi.dx = $dx; $mi.dy = $dy; $mi.mouseData = $data; $mi.dwFlags = $flags
  $u = New-Object NativeInput+INPUTUNION
  $u.mi = $mi
  $inp = New-Object NativeInput+INPUT
  $inp.type = 0
  $inp.U = $u
  [NativeInput]::SendInput(1, [NativeInput+INPUT[]]@($inp), [Runtime.InteropServices.Marshal]::SizeOf($inp)) | Out-Null
}

function Send-Key([ushort]$vk, [bool]$up) {
  $ki = New-Object NativeInput+KEYBDINPUT
  $ki.wVk = $vk; $ki.dwFlags = $(if ($up) { $KEYEVENTF_KEYUP } else { 0 })
  $u = New-Object NativeInput+INPUTUNION
  $u.ki = $ki
  $inp = New-Object NativeInput+INPUT
  $inp.type = 1
  $inp.U = $u
  [NativeInput]::SendInput(1, [NativeInput+INPUT[]]@($inp), [Runtime.InteropServices.Marshal]::SizeOf($inp)) | Out-Null
}

function Send-Text([string]$text) {
  foreach ($ch in $text.ToCharArray()) {
    $ki = New-Object NativeInput+KEYBDINPUT
    $ki.wVk = 0; $ki.wScan = [ushort][int]$ch; $ki.dwFlags = $KEYEVENTF_UNICODE
    $u = New-Object NativeInput+INPUTUNION
    $u.ki = $ki
    $inp = New-Object NativeInput+INPUT
    $inp.type = 1
    $inp.U = $u
    [NativeInput]::SendInput(1, [NativeInput+INPUT[]]@($inp), [Runtime.InteropServices.Marshal]::SizeOf($inp)) | Out-Null
  }
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $cmd = $line | ConvertFrom-Json
    switch ($cmd.type) {
      'move'  { [NativeInput]::SetCursorPos([int]$cmd.x, [int]$cmd.y) | Out-Null }
      'click' {
        $down = 0; $up = 0
        switch ($cmd.button) {
          'right'  { $down = $MOUSEEVENTF_RIGHTDOWN;  $up = $MOUSEEVENTF_RIGHTUP }
          'middle' { $down = $MOUSEEVENTF_MIDDLEDOWN; $up = $MOUSEEVENTF_MIDDLEUP }
          default  { $down = $MOUSEEVENTF_LEFTDOWN;   $up = $MOUSEEVENTF_LEFTUP }
        }
        if ($cmd.down) { Send-Mouse $down 0 0 0 } else { Send-Mouse $up 0 0 0 }
      }
      'wheel' { Send-Mouse $MOUSEEVENTF_WHEEL 0 0 ([uint32]$cmd.delta) }
      'key'   { Send-Key ([ushort]$cmd.vk) ([bool]$cmd.up) }
      'text'  { Send-Text ([string]$cmd.text) }
    }
    Write-Output '{"ok":true}'
  } catch {
    Write-Output ('{"error":"' + $_.Exception.Message + '"}')
  }
}
