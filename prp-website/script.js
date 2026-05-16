function updateJoinLinks(){
  const ip=document.getElementById('serverIp')?.value||'YOUR_SERVER_IP:30120';
  const link='fivem://connect/'+ip;
  document.getElementById('joinBtn').href=link;
  document.getElementById('openFiveM').href=link;
}
document.getElementById('serverIp').addEventListener('input',updateJoinLinks);updateJoinLinks();
function setMode(mode){
  const username=document.getElementById('username');
  const password=document.getElementById('password');
  const submit=document.getElementById('authSubmit');
  username.style.display=mode==='signup'?'block':'none';
  password.style.display=mode==='forgot'?'none':'block';
  submit.textContent=mode==='forgot'?'Send Reset Link':mode==='signup'?'Create Account':'Login';
}
setMode('login');
