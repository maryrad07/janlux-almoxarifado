$projectDir = "C:\Users\Usuário\.gemini\antigravity\scratch\janlux-almoxarifado"
$batPath    = "$projectDir\iniciar_sistema.bat"
$desktop    = [System.Environment]::GetFolderPath("Desktop")
$atalho     = "$desktop\JANLUX Sistema.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$link = $WshShell.CreateShortcut($atalho)
$link.TargetPath       = $batPath
$link.WorkingDirectory = $projectDir
$link.Description      = "JANLUX - Sistema de Almoxarifado e Expedicao"
$link.IconLocation     = "C:\Windows\System32\shell32.dll,21"
$link.Save()

Write-Host "Atalho recriado com sucesso apontando para iniciar_sistema.bat!"
