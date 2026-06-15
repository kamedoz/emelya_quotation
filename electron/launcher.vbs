Set Shell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
appDir = FSO.GetParentFolderName(scriptDir)
distIndex = FSO.BuildPath(appDir, "dist\index.html")
If Not FSO.FileExists(distIndex) Then
  Shell.Run "cmd /c npm.cmd run build", 0, True
End If
electronExe = FSO.BuildPath(appDir, "node_modules\electron\dist\electron.exe")
Q = Chr(34)
cmd = Q & electronExe & Q & " " & Q & appDir & Q
Shell.CurrentDirectory = appDir
Shell.Run cmd, 0, False
