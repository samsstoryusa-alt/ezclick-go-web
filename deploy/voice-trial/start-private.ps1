param([switch]$WithKey)
$ErrorActionPreference = 'Stop'
$env:VOICE_TRIAL_UNLIMITED = '0'
$env:VOICE_TRIAL_PORT = '5196'
if (-not $WithKey) {
    Write-Host 'Opening the local trial without waiting for an API key: http://127.0.0.1:5196/'
    & node (Join-Path $PSScriptRoot 'server.mjs')
    exit $LASTEXITCODE
}
Write-Host 'EZCLICK voice trial - local server only.'
Write-Host 'Paste your OpenAI API key below. Input is hidden; it is not saved to a file.'
$voiceSecret = Read-Host 'OpenAI API key' -AsSecureString
$voicePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($voiceSecret)
try {
    $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($voicePointer)
    if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) { throw 'No key entered.' }
    $voiceServerFile = Join-Path $PSScriptRoot 'server.mjs'
    $voiceListeners = @(Get-NetTCPConnection -LocalPort 5196 -State Listen -ErrorAction SilentlyContinue)
    foreach ($voiceListener in $voiceListeners) {
        $voiceExisting = Get-CimInstance Win32_Process -Filter "ProcessId = $($voiceListener.OwningProcess)"
        if ($voiceListener.LocalAddress -ne '127.0.0.1' -or $voiceExisting.Name -ne 'node.exe' -or -not $voiceExisting.CommandLine.Contains($voiceServerFile)) {
            throw 'Port 5196 is occupied by another program. Nothing was stopped.'
        }
        Stop-Process -Id $voiceListener.OwningProcess
        Wait-Process -Id $voiceListener.OwningProcess -Timeout 5 -ErrorAction SilentlyContinue
    }
    $env:VOICE_TRIAL_SEND = '1'
    $env:VOICE_TRIAL_PORT = '5196'
    Write-Host 'Open http://127.0.0.1:5196/ - up to 20 requests per day; one request at a time.'
    Write-Host 'Press Ctrl+C to stop. The key is held in this process, not in the browser.'
    & node (Join-Path $PSScriptRoot 'server.mjs')
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($voicePointer)
    Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:VOICE_TRIAL_SEND -ErrorAction SilentlyContinue
    Remove-Item Env:VOICE_TRIAL_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:VOICE_TRIAL_UNLIMITED -ErrorAction SilentlyContinue
    $voiceSecret.Dispose()
}
