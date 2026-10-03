# Start the private precipitation-type connection used by the localhost preview.
$localPort = 8766
if (Get-NetTCPConnection -LocalPort $localPort -State Listen -ErrorAction SilentlyContinue) {
  Write-Output 'Port 8766 is already listening. Check http://127.0.0.1:8766/frames.'
  exit 0
}
$precipKey = Join-Path $env:USERPROFILE '.ssh/ezclick_ovh_ed25519'
if (-not (Test-Path -LiteralPath $precipKey)) { throw 'The existing OVH SSH key was not found.' }
Start-Process -FilePath 'ssh.exe' -WindowStyle Hidden -ArgumentList @('-N','-i',('"'+$precipKey+'"'),'-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-L','127.0.0.1:8766:127.0.0.1:8766','ubuntu@40.160.37.103')
Write-Output 'Started the private precipitation-type connection.'
