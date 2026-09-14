; TrackCast installer customizations.
; Included by electron-builder (package.json > build.nsis.include) in both the
; installer and uninstaller scripts, before the wizard pages are declared.
;
; Detects an existing installation and adapts the wizard:
;   install    no previous version        Welcome > License > Install mode > Folder > Install > Finish
;   update     older version installed    Welcome ("Update") > Install > Finish
;   reinstall  same version installed     Welcome ("Reinstall") > Install > Finish
;   downgrade  newer version installed    confirmation dialog, then the update flow
; User settings live in %APPDATA%\TrackCast and are never touched by the installer.

!ifndef BUILD_UNINSTALLER

!include "LogicLib.nsh"
!include "WordFunc.nsh"

; Pages between Welcome and Install in electron-builder 25.x assisted mode:
; License (1), Install mode (2), Installation folder (3), Install (4).
!define TC_PAGES_TO_INSTALL 4

Var tcInstalledVersion
Var tcInstallAction
Var tcWelcomeTitle
Var tcWelcomeText
Var tcWelcomeButton
Var tcFinishTitle
Var tcFinishText

!define MUI_FINISHPAGE_TITLE "$tcFinishTitle"
!define MUI_FINISHPAGE_TEXT "$tcFinishText"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME}"

!macro tcReadInstalledVersion
  StrCpy $tcInstalledVersion ""
  ReadRegStr $tcInstalledVersion HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${if} $tcInstalledVersion == ""
    ReadRegStr $tcInstalledVersion HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${endIf}
!macroend

!macro customInit
  !insertmacro tcReadInstalledVersion

  StrCpy $tcInstallAction "install"
  StrCpy $tcWelcomeButton ""
  StrCpy $tcWelcomeTitle "Welcome to ${PRODUCT_NAME}"
  StrCpy $tcWelcomeText "${PRODUCT_NAME} shows the song you're playing on Spotify as a live text overlay in OBS Studio.$\r$\n$\r$\nThis wizard installs version ${VERSION} on your computer.$\r$\n$\r$\nClick Next to continue."
  StrCpy $tcFinishTitle "${PRODUCT_NAME} is ready"
  StrCpy $tcFinishText "${PRODUCT_NAME} ${VERSION} is installed. Launch it to connect Spotify and OBS Studio."

  ${if} $tcInstalledVersion != ""
    ${VersionCompare} "${VERSION}" "$tcInstalledVersion" $R0

    ${if} $R0 == "1"
      StrCpy $tcInstallAction "update"
      StrCpy $tcWelcomeButton "&Update"
      StrCpy $tcWelcomeTitle "Update ${PRODUCT_NAME}"
      StrCpy $tcWelcomeText "${PRODUCT_NAME} $tcInstalledVersion is installed on this computer. This updates it to version ${VERSION}.$\r$\n$\r$\nYour settings and Spotify connection are kept. If ${PRODUCT_NAME} is running, it will be closed first.$\r$\n$\r$\nClick Update to continue."
      StrCpy $tcFinishTitle "${PRODUCT_NAME} is up to date"
      StrCpy $tcFinishText "You're now on version ${VERSION}. Your settings were kept."
    ${elseIf} $R0 == "0"
      StrCpy $tcInstallAction "reinstall"
      StrCpy $tcWelcomeButton "&Reinstall"
      StrCpy $tcWelcomeTitle "Repair ${PRODUCT_NAME}"
      StrCpy $tcWelcomeText "${PRODUCT_NAME} ${VERSION} is already installed on this computer. Reinstalling replaces the app files, which fixes most broken installations.$\r$\n$\r$\nYour settings and Spotify connection are kept.$\r$\n$\r$\nClick Reinstall to continue."
      StrCpy $tcFinishTitle "${PRODUCT_NAME} is repaired"
      StrCpy $tcFinishText "${PRODUCT_NAME} ${VERSION} was reinstalled. Your settings were kept."
    ${else}
      StrCpy $tcInstallAction "downgrade"
      ${ifNot} ${Silent}
        MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "A newer version of ${PRODUCT_NAME} ($tcInstalledVersion) is installed.$\r$\n$\r$\nDo you want to replace it with the older version ${VERSION}? Your settings are kept." IDYES tcDowngradeConfirmed
        Quit
        tcDowngradeConfirmed:
      ${endIf}
      StrCpy $tcWelcomeButton "&Install"
      StrCpy $tcWelcomeTitle "Install an older version"
      StrCpy $tcWelcomeText "${PRODUCT_NAME} $tcInstalledVersion is installed on this computer. This replaces it with version ${VERSION}.$\r$\n$\r$\nYour settings and Spotify connection are kept.$\r$\n$\r$\nClick Install to continue."
      StrCpy $tcFinishTitle "${PRODUCT_NAME} ${VERSION} is installed"
      StrCpy $tcFinishText "The older version replaced $tcInstalledVersion. Your settings were kept."
    ${endIf}
  ${endIf}
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$tcWelcomeTitle"
  !define MUI_WELCOMEPAGE_TEXT "$tcWelcomeText"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW tcWelcomeShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE tcWelcomeLeave
  !insertmacro MUI_PAGE_WELCOME

  !define MUI_LICENSEPAGE_TEXT_TOP "${PRODUCT_NAME} is free, open-source software released under the MIT License."
  !insertmacro MUI_PAGE_LICENSE "${PROJECT_DIR}\LICENSE"

  ; Defined here (not at file level) because $hasPerMachineInstallation is declared
  ; by electron-builder's multiUser.nsh, which is included after this file.
  Function tcWelcomeShow
    ${if} $tcWelcomeButton != ""
      GetDlgItem $0 $HWNDPARENT 1
      SendMessage $0 ${WM_SETTEXT} 0 "STR:$tcWelcomeButton"
    ${endIf}
  FunctionEnd

  Function tcWelcomeLeave
    ; Existing per-user installation: keep its location and install mode, go straight to Install.
    ; Per-machine installations keep the regular pages so elevation still happens.
    ${if} $tcInstallAction != "install"
    ${andIf} $hasPerMachineInstallation != "1"
      SendMessage $HWNDPARENT 0x408 ${TC_PAGES_TO_INSTALL} 0
      Abort
    ${endIf}
  FunctionEnd
!macroend

!endif
