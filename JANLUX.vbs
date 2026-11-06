' JANLUX — Iniciador Silencioso
' Este arquivo inicia o servidor em segundo plano e abre o navegador automaticamente.
' Não exibe janela preta do console.

Dim WshShell, oExec, fso, projectDir, nodeExe

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Diretório do projeto (mesmo local deste arquivo)
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Localiza o Node.js
Dim nodePaths(3)
nodePaths(0) = "C:\Program Files\nodejs\node.exe"
nodePaths(1) = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe")
nodePaths(2) = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe")
nodePaths(3) = "node.exe"

nodeExe = ""
Dim i
For i = 0 To 3
    If fso.FileExists(nodePaths(i)) Or nodePaths(i) = "node.exe" Then
        nodeExe = nodePaths(i)
        Exit For
    End If
Next

If nodeExe = "" Then
    MsgBox "Node.js não encontrado!" & vbCrLf & vbCrLf & _
           "Instale o Node.js em: https://nodejs.org" & vbCrLf & _
           "e tente novamente.", vbCritical, "JANLUX — Erro de Inicialização"
    WScript.Quit 1
End If

' Verifica se o servidor já está rodando tentando conectar
Dim http
Set http = CreateObject("MSXML2.XMLHTTP")
Dim jaRodando
jaRodando = False

On Error Resume Next
http.Open "GET", "http://localhost:3000", False
http.Send
If Err.Number = 0 And http.Status > 0 Then
    jaRodando = True
End If
On Error GoTo 0

If jaRodando Then
    ' Já está rodando — só abre o navegador
    WshShell.Run "http://localhost:3000", 1, False
    WScript.Quit 0
End If

' Inicia o servidor em segundo plano (sem janela preta)
Dim cmd
cmd = """" & nodeExe & """ """ & projectDir & "\src\server.js"""
WshShell.Run cmd, 0, False  ' 0 = sem janela visível

' Aguarda 2 segundos para o servidor subir
WScript.Sleep 2000

' Abre o navegador padrão
WshShell.Run "http://localhost:3000", 1, False

Set WshShell = Nothing
Set fso = Nothing
