# Check backend deployment status
$url = "https://ecommerce-backend-v2-j7i3.onrender.com"

Write-Host "Checking backend deployment..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Yellow
Write-Host ""

for ($i = 1; $i -le 30; $i++) {
    try {
        Write-Host "[$i/30] Attempting to connect..." -NoNewline
        $response = Invoke-RestMethod -Uri $url -TimeoutSec 10 -ErrorAction Stop
        Write-Host " SUCCESS!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Response:" -ForegroundColor Cyan
        Write-Host ($response | ConvertTo-Json -Depth 3)
        Write-Host ""
        Write-Host "🎉 Your backend is LIVE!" -ForegroundColor Green
        Write-Host "API URL: $url" -ForegroundColor Blue
        break
    }
    catch {
        Write-Host " Not ready yet" -ForegroundColor Yellow
        if ($i -lt 30) {
            Write-Host "   Waiting 20 seconds before retry..." -ForegroundColor Gray
            Start-Sleep -Seconds 20
        } else {
            Write-Host ""
            Write-Host "⚠️  Deployment is taking longer than expected" -ForegroundColor Yellow
            Write-Host "Check build logs: https://dashboard.render.com/web/srv-d6mbgp5m5p6s73fnlpo0" -ForegroundColor Blue
        }
    }
}
