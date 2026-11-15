; Instalador do Sistema de Atendimento Espiritual (NSIS 3)
; Gerar no Linux:   makensis instalador.nsi
; Gerar no Windows: instale o NSIS e clique com o botão direito > "Compile NSIS Script"
; Requer o arquivo node.exe (Node.js 22 LTS, 64 bits) em ..\vendor\node.exe

Unicode true
!include "MUI2.nsh"

!define NOME "Atendimento Espiritual"
!define VERSAO "1.9.3"
!define PORTA "3210"
!define CHAVE_DESINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\AtendimentoEspiritual"

Name "${NOME}"
OutFile "..\dist\Instalar-Atendimento-Espiritual-${VERSAO}.exe"
InstallDir "$PROGRAMFILES64\${NOME}"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
BrandingText "Sistema de Atendimento Espiritual ${VERSAO}"
VIProductVersion "${VERSAO}.0"
VIAddVersionKey "ProductName" "${NOME}"
VIAddVersionKey "FileDescription" "Instalador do ${NOME}"
VIAddVersionKey "FileVersion" "${VERSAO}"
VIAddVersionKey "ProductVersion" "${VERSAO}"
VIAddVersionKey "LegalCopyright" "Código aberto"

!define MUI_ICON "icone.ico"
!define MUI_UNICON "icone.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao ${NOME}"
!define MUI_WELCOMEPAGE_TEXT "Este assistente vai instalar o Sistema de Atendimento Espiritual neste computador.$\r$\n$\r$\nOs dados ficam guardados somente neste computador. Outros aparelhos no mesmo Wi-Fi poderão acessar pelo navegador.$\r$\n$\r$\nClique em Avançar para continuar."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o sistema agora"
!define MUI_FINISHPAGE_RUN_FUNCTION AbrirSistema

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Function AbrirSistema
  Exec '"$WINDIR\System32\wscript.exe" "$INSTDIR\iniciar.vbs"'
FunctionEnd

Section "Sistema de Atendimento Espiritual (obrigatório)" SecPrincipal
  SectionIn RO
  SetShellVarContext all  ; atalhos para todos os usuarios e $APPDATA = C:\ProgramData
  ; encerra uma versão aberta antes de atualizar
  nsExec::Exec `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like '$INSTDIR\node\*' } | Stop-Process -Force"`
  Sleep 500

  SetOutPath "$INSTDIR\node"
  File "..\vendor\node.exe"
  SetOutPath "$INSTDIR\app"
  File "..\app\server.js"
  SetOutPath "$INSTDIR\app\public"
  File "..\app\public\*.*"
  SetOutPath "$INSTDIR"
  File "iniciar.vbs"
  File "recuperar.vbs"
  File "icone.ico"

  ; pasta de dados com permissão de escrita para os usuários do Windows
  CreateDirectory "$APPDATA\AtendimentoEspiritual"
  nsExec::Exec 'icacls "$APPDATA\AtendimentoEspiritual" /grant *S-1-5-32-545:(OI)(CI)M /T'

  ; libera o acesso de outros aparelhos da rede local (somente este programa e esta porta)
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${NOME}"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="${NOME}" dir=in action=allow program="$INSTDIR\node\node.exe" protocol=TCP localport=${PORTA} profile=any enable=yes'

  ; atalhos
  CreateShortCut "$DESKTOP\${NOME}.lnk" "$WINDIR\System32\wscript.exe" '"$INSTDIR\iniciar.vbs"' "$INSTDIR\icone.ico" 0
  CreateDirectory "$SMPROGRAMS\${NOME}"
  CreateShortCut "$SMPROGRAMS\${NOME}\${NOME}.lnk" "$WINDIR\System32\wscript.exe" '"$INSTDIR\iniciar.vbs"' "$INSTDIR\icone.ico" 0
  CreateShortCut "$SMPROGRAMS\${NOME}\Recuperar acesso de administrador.lnk" "$WINDIR\System32\wscript.exe" '"$INSTDIR\recuperar.vbs"' "$INSTDIR\icone.ico" 0
  CreateShortCut "$SMPROGRAMS\${NOME}\Pasta dos dados e backups.lnk" "$APPDATA\AtendimentoEspiritual"
  CreateShortCut "$SMPROGRAMS\${NOME}\Desinstalar.lnk" "$INSTDIR\desinstalar.exe"

  ; registro para "Adicionar ou remover programas"
  WriteUninstaller "$INSTDIR\desinstalar.exe"
  WriteRegStr HKLM "${CHAVE_DESINST}" "DisplayName" "${NOME}"
  WriteRegStr HKLM "${CHAVE_DESINST}" "DisplayVersion" "${VERSAO}"
  WriteRegStr HKLM "${CHAVE_DESINST}" "Publisher" "Comunidade espírita (código aberto)"
  WriteRegStr HKLM "${CHAVE_DESINST}" "DisplayIcon" "$INSTDIR\icone.ico"
  WriteRegStr HKLM "${CHAVE_DESINST}" "UninstallString" '"$INSTDIR\desinstalar.exe"'
  WriteRegDWORD HKLM "${CHAVE_DESINST}" "NoModify" 1
  WriteRegDWORD HKLM "${CHAVE_DESINST}" "NoRepair" 1
SectionEnd

Section "Iniciar junto com o Windows (recomendado no computador central)" SecInicio
  SetShellVarContext all
  CreateShortCut "$SMSTARTUP\${NOME}.lnk" "$WINDIR\System32\wscript.exe" '"$INSTDIR\iniciar.vbs" /semnavegador' "$INSTDIR\icone.ico" 0
SectionEnd

LangString DESC_Principal ${LANG_PORTUGUESEBR} "Programa, atalho na área de trabalho e liberação no firewall para os outros aparelhos da rede."
LangString DESC_Inicio ${LANG_PORTUGUESEBR} "O sistema já fica disponível para tablets e celulares assim que o computador é ligado."
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecPrincipal} $(DESC_Principal)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecInicio} $(DESC_Inicio)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  SetShellVarContext all
  nsExec::Exec `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like '$INSTDIR\node\*' } | Stop-Process -Force"`
  Sleep 500
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${NOME}"'
  Delete "$DESKTOP\${NOME}.lnk"
  Delete "$DESKTOP\Encerrar ${NOME}.lnk"
  RMDir /r "$SMPROGRAMS\${NOME}"
  Delete "$SMSTARTUP\${NOME}.lnk"
  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\node"
  Delete "$INSTDIR\iniciar.vbs"
  Delete "$INSTDIR\recuperar.vbs"
  Delete "$INSTDIR\encerrar.vbs"  ; remove o atalho de versões anteriores, se existir
  Delete "$INSTDIR\icone.ico"
  Delete "$INSTDIR\desinstalar.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "${CHAVE_DESINST}"
  MessageBox MB_ICONINFORMATION "O programa foi removido.$\r$\n$\r$\nOs dados dos pacientes e os backups NÃO foram apagados e continuam em:$\r$\n$APPDATA\AtendimentoEspiritual"
SectionEnd
