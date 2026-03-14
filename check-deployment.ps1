# Check deployment status
$url = "https://test-hello-world-6thk.onrender.com"

Write-Host "Checking deployment status..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Yellow
Write-Host ""

for ($i = 1; $i -le 20; $i++) {
    try {
        Write-Host "[$i/20] Attempting to connect..." -NoNewline
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -ErrorAction Stop
        Write-Host " SUCCESS!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Content Preview:" -ForegroundColor Cyan
        Write-Host $response.Content.Substring(0, [Math]::Min(200, $response.Content.Length))
        Write-Host ""
        Write-Host "🎉 Your app is LIVE at: $url" -ForegroundColor Green
        break
    }
    catch {
        Write-Host " Not ready yet" -ForegroundColor Yellow
        if ($i -lt 20) {
            Write-Host "   Waiting 30 seconds before retry..." -ForegroundColor Gray
            Start-Sleep -Seconds 30
        }
    }
}

Write-Host ""
Write-Host "You can also check the build logs at:" -ForegroundColor Cyan
Write-Host "https://dashboard.render.com/web/srv-d6marfbh46gs73bi2dv0" -ForegroundColor Blue
