"""从云服务器同步 data 目录到本地"""
from scp import SCPClient
import paramiko, os, traceback

HOST = '124.220.52.22'
USER = 'root'
PASS = '13303382881Zhang!'
REMOTE_DIR = '/opt/data'
LOCAL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print('Connecting...')
    ssh.connect(HOST, username=USER, password=PASS, timeout=30,
                allow_agent=False, look_for_keys=False)
    print('Connected!')

    scp = SCPClient(ssh.get_transport())

    stdin, stdout, stderr = ssh.exec_command('ls -1 /opt/data')
    remote_files = [f for f in stdout.read().decode().strip().split('\n') if f.strip()]
    err = stderr.read().decode().strip()
    if err:
        print(f'STDERR: {err}')
    print(f'Found {len(remote_files)} files on server:')
    for f in remote_files:
        print(f'  {f}')

    print(f'\nDownloading to {LOCAL_DIR}...')
    for f in remote_files:
        remote_path = f'/opt/data/{f}'
        local_path = os.path.join(LOCAL_DIR, f)
        try:
            scp.get(remote_path, local_path)
            size = os.path.getsize(local_path)
            print(f'  OK  {f}  ({size} bytes)')
        except Exception as e:
            print(f'  FAIL  {f}: {e}')

    scp.close()
    ssh.close()
    print('\nAll done!')
except Exception as e:
    traceback.print_exc()
