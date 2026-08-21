param (
    [string]$Token = ""
)

$git = "C:\Users\Cyborg 15\.gemini\antigravity\scratch\mingit\cmd\git.exe"
$gh = "C:\Users\Cyborg 15\.gemini\antigravity\scratch\gh\bin\gh.exe"

if ($Token -ne "") {
    Write-Host "Authenticating with provided GitHub token..."
    $Token | & $gh auth login --with-token
}

$status = & $gh auth status 2>&1
Write-Host $status

if ($LASTEXITCODE -ne 0) {
    Write-Host "Please authenticate with GitHub. Launching browser login..." -ForegroundColor Yellow
    & $gh auth login --web --git-protocol https
}

Write-Host "Creating public GitHub repository 'interactive-floor-planner' and pushing code..." -ForegroundColor Cyan
& $gh repo create interactive-floor-planner --public --source=. --remote=origin --push

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS! Repository created and all files pushed." -ForegroundColor Green
    & $gh repo view --web
} else {
    Write-Host "If repo already exists, trying normal git push..." -ForegroundColor Yellow
    & $git push -u origin main
}
