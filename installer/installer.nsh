; Installs the Microsoft Visual C++ runtime (needed by the speech engine) if it isn't there yet.
; ExecShellWait lets Windows show its permission prompt, since the runtime installs for all users.
!macro customInstall
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != 1
    DetailPrint "Installing Microsoft Visual C++ runtime..."
    ExecShellWait "open" "$INSTDIR\resources\redist\vc_redist.x64.exe" "/install /quiet /norestart" SW_HIDE
  ${EndIf}
!macroend
