# Cria atalho do sistema JANLUX na Area de Trabalho
$projectDir = "C:\Users\Usuário\.gemini\antigravity\scratch\janlux-almoxarifado"
$vbsPath    = "$projectDir\JANLUX.vbs"
$desktop    = [System.Environment]::GetFolderPath("Desktop")
$atalho     = "$desktop\JANLUX Sistema.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$link = $WshShell.CreateShortcut($atalho)
$link.TargetPath       = "wscript.exe"
$link.Arguments        = "`"$vbsPath`""
$link.WorkingDirectory = $projectDir
$link.Description      = "JANLUX Almoxarifado e Expedicao"
$link.IconLocation     = "C:\Windows\System32\shell32.dll,21"
$link.Save()

Write-Host "Atalho criado na Area de Trabalho: $atalho"
