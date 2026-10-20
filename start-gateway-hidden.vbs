Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Alegra\Desktop\Robin"
WshShell.Run """C:\Program Files\Git\bin\bash.exe"" -c ""cd /c/Users/Alegra/Desktop/Robin && ./run.sh gateway >> gateway.log 2>&1""", 0, True
