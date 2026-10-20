Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Alegra\Desktop\Robin\google-chat-bot"
WshShell.Run """C:\Users\Alegra\Desktop\Robin\google-chat-bot\start-loop.bat""", 0, False
