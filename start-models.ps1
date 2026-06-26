# Start the MoleCraft model services (Windows PowerShell)
# Requires: Python 3.11+ with rdkit, scikit-learn, fastapi, uvicorn, httpx

$PSStyle.Progress.UseOSShell = $false

Write-Host "Starting MoleCraft model services..." -ForegroundColor Cyan

$services = @(
    @{Name="Affinity Predictor"; Port=8001; Dir="models\affinity_predictor"},
    @{Name="Molecule Generator"; Port=8000; Dir="models\generative"},
    @{Name="RAG Pipeline"; Port=8002; Dir="models\rag_pipeline"},
    @{Name="Docking"; Port=8003; Dir="models\docking"},
    @{Name="Proteochem"; Port=8004; Dir="models\proteochem"}
)

foreach ($svc in $services) {
    Start-Job -Name $svc.Name -ScriptBlock {
        param($dir, $port)
        Set-Location $using:PWD\$dir
        python -m uvicorn main:app --host 0.0.0.0 --port $port --reload
    } -ArgumentList $svc.Dir, $svc.Port | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "  $($svc.Name): http://localhost:$($svc.Port)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor Yellow

try {
    while ($true) {
        Start-Sleep -Seconds 2
        $jobs = Get-Job -State Running
        if ($jobs.Count -eq 0) {
            Write-Host "All services have stopped." -ForegroundColor Red
            break
        }
    }
}
finally {
    Write-Host "Shutting down..." -ForegroundColor Yellow
    Get-Job | Stop-Job -PassThru | Remove-Job
}
