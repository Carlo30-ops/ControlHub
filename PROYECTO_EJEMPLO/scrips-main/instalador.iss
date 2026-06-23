; Inno Setup - Generador de Reportes COTU
; Genera Setup_GeneradorCOTU.exe para instalar en otro PC con asistente,
; menú Inicio y desinstalador en "Agregar o quitar programas".
; Requisito: debe existir dist\GeneradorCOTU.exe (ejecutar antes crear_instalador.bat).
; Compilar: iscc instalador.iss   o abrir este archivo en Inno Setup y pulsar Compilar.

#define MyAppName "Generador de Reportes COTU"
#define MyAppVersion "1.0"
#define MyAppPublisher "Generador COTU"
#define MyAppExeName "GeneradorCOTU.exe"
#define MyAppURL "https://github.com"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\GeneradorCOTU
DefaultGroupName=Generador COTU
DisableProgramGroupPage=yes
OutputDir=dist_installer
OutputBaseFilename=Setup_GeneradorCOTU
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DefaultLanguage=spanish
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Files]
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "Generar reportes Excel/CSV de facturas COTU"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"; Comment: "Quitar la aplicación del equipo"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Ejecutar {#MyAppName} ahora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: dirifempty; Name: "{app}"
