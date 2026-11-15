' Abre o Sistema de Atendimento Espiritual sem mostrar a janela do prompt.
' Use /semnavegador para iniciar sem abrir o navegador (inicio automatico com o Windows).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
abrir = " --abrir"
If WScript.Arguments.Count > 0 Then
  If LCase(WScript.Arguments(0)) = "/semnavegador" Then abrir = ""
End If
sh.Run """" & pasta & "\node\node.exe"" --no-warnings """ & pasta & "\app\server.js""" & abrir, 0, False
