# One-time: gh auth login
# Then run from repo root: .\scripts\publish-to-github.ps1

$ErrorActionPreference = "Stop"
$repoName = "toronto-drop-in"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "Install GitHub CLI: winget install GitHub.cli"
  exit 1
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login"
  exit 1
}

Set-Location (Split-Path $PSScriptRoot -Parent)

if (git remote get-url origin 2>$null) {
  Write-Host "Remote origin already set. Pushing..."
  git push -u origin main
} else {
  gh repo create $repoName --public `
    --description "Find drop-in sports at Toronto community centres" `
    --source=. --remote=origin --push
}

Write-Host ""
Write-Host "Done. Repo URL:"
gh repo view --web 2>$null
gh repo view --json url -q .url
