$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
npm run prepare:production
npm start