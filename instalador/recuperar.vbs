' Recupera o acesso de administrador quando a senha foi esquecida.
' Gera uma senha temporaria e a mostra na tela. Depois e so entrar e trocar a senha.
Option Explicit
Dim sh, fso, pasta, usuario, arg, node, servidor, ex, saida
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)

usuario = InputBox("RECUPERAR ACESSO DE ADMINISTRADOR" & vbCrLf & vbCrLf & _
  "Digite o nome de usuario do administrador." & vbCrLf & _
  "(Deixe em branco para recuperar o administrador principal.)", "Atendimento Espiritual")

arg = ""
If Len(Trim(usuario)) > 0 Then arg = " --usuario=""" & Trim(usuario) & """"

node = """" & pasta & "\node\node.exe"""
servidor = """" & pasta & "\app\server.js"""

' Executa diretamente (sem cmd nem redirecionamento, evitando problemas com espacos no caminho)
On Error Resume Next
Set ex = sh.Exec(node & " --no-warnings " & servidor & " --recuperar" & arg)
If Err.Number <> 0 Then
  MsgBox "Nao foi possivel iniciar a recuperacao." & vbCrLf & vbCrLf & Err.Description, vbExclamation, "Atendimento Espiritual"
  WScript.Quit
End If
On Error GoTo 0

Do While ex.Status = 0
  WScript.Sleep 50
Loop
saida = ex.StdOut.ReadAll()

Dim pos, linha, partes, usuarioRec, senhaRec
If Len(Trim(saida)) = 0 Then
  MsgBox "A recuperacao nao retornou resposta. Verifique se o sistema esta instalado corretamente.", vbExclamation, "Atendimento Espiritual"
ElseIf InStr(saida, "OK|") > 0 Then
  linha = Mid(saida, InStr(saida, "OK|"))
  partes = Split(linha, "|")
  usuarioRec = ""
  senhaRec = ""
  If UBound(partes) >= 1 Then usuarioRec = Trim(partes(1))
  If UBound(partes) >= 2 Then senhaRec = Trim(Replace(Replace(partes(2), vbCr, ""), vbLf, ""))
  MsgBox "Acesso recuperado!" & vbCrLf & vbCrLf & _
    "Usuario: " & usuarioRec & vbCrLf & _
    "Senha temporaria: " & senhaRec & vbCrLf & vbCrLf & _
    "Abra o sistema, entre com esta senha e troque-a em 'Alterar minha senha'.", _
    vbInformation, "Atendimento Espiritual"
ElseIf InStr(saida, "ERRO|") > 0 Then
  pos = InStr(saida, "ERRO|") + 5
  MsgBox "Nao foi possivel recuperar:" & vbCrLf & vbCrLf & Trim(Mid(saida, pos)), vbExclamation, "Atendimento Espiritual"
Else
  MsgBox "Nao foi possivel recuperar o acesso. Detalhe:" & vbCrLf & vbCrLf & saida, vbExclamation, "Atendimento Espiritual"
End If
