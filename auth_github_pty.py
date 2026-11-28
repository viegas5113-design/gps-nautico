#!/usr/bin/env python3
import pty
import os
import re
import sys
import time

LOG_FILE = "/tmp/gh_auth_pty.log"
CODE_FILE = "/tmp/gh_code.txt"

pid, fd = pty.fork()
if pid == 0:
    os.execv('/home/luis/.local/bin/gh', [
        'gh', 'auth', 'login',
        '--hostname', 'github.com',
        '--git-protocol', 'https',
        '--web'
    ])
else:
    with open(LOG_FILE, "wb") as f_log:
        buffer = b""
        answered_git = False
        answered_browser = False
        code_found = None

        while True:
            try:
                chunk = os.read(fd, 1024)
                if not chunk:
                    break
                buffer += chunk
                f_log.write(chunk)
                f_log.flush()

                decoded = buffer.decode("utf-8", errors="ignore")

                # 1. Answer Git credentials prompt
                if not answered_git and "Authenticate Git with your GitHub credentials" in decoded:
                    os.write(fd, b"Y\n")
                    answered_git = True
                    print("[PTY] Respondido 'Y' para Git credentials")

                # 2. Capture one-time code
                if not code_found:
                    match = re.search(r"First copy your one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})", decoded)
                    if match:
                        code_found = match.group(1)
                        with open(CODE_FILE, "w") as f_code:
                            f_code.write(code_found)
                        print(f"\n==========================================")
                        print(f"🔑 NOVO CÓDIGO GITHUB: {code_found}")
                        print(f"👉 Abrir: https://github.com/login/device")
                        print(f"==========================================\n")

                # 3. Answer press Enter prompt if needed
                if "Press Enter to open" in decoded and not answered_browser:
                    os.write(fd, b"\n")
                    answered_browser = True
                    print("[PTY] Pressionado Enter para abrir browser")

                # 4. Check for success
                if "Authentication complete" in decoded or "Logged in as" in decoded:
                    print("\n🎉 AUTENTICAÇÃO GITHUB CONCLUÍDA COM SUCESSO!\n")
                    break

            except OSError:
                break

    os.waitpid(pid, 0)
