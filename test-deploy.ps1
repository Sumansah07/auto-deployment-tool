$body = @{
    appName = "hello-world-test"
    files = @(
        @{
            path = "package.json"
            content = '{"name":"hello-world","version":"1.0.0","scripts":{"start":"node index.js"},"dependencies":{"express":"^4.18.2"}}'
        },
        @{
            path = "index.js"
            content = "const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello World!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));"
        }
    )
    env = @{
        NODE_ENV = "production"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Sending deployment request..."
Write-Host $body

$response = Invoke-WebRequest -Uri http://localhost:3001/deploy -Method POST -ContentType "application/json" -Body $body -UseBasicParsing

Write-Host "Response:"
$response.Content | ConvertFrom-Json | ConvertTo-Json
