#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const source=process.env.TOKENSHIELD_SOURCE || path.resolve(import.meta.dirname,'..');
const home=process.env.HOME || os.homedir();
const install=path.join(home,'.tokenshield','app');
if(path.resolve(source)===path.resolve(install))throw Error('Run installer from an extracted copy outside ~/.tokenshield/app');
fs.mkdirSync(path.dirname(install),{recursive:true});
fs.cpSync(source,install,{recursive:true,force:true,filter:(src)=>!src.split(path.sep).some(s=>['node_modules','.tokenshield','.git'].includes(s))});
const skillDir=path.join(home,'.claude','skills','tokenshield');
fs.mkdirSync(skillDir,{recursive:true});
fs.copyFileSync(path.join(source,'integrations','claude-skill','SKILL.md'),path.join(skillDir,'SKILL.md'));
const settingsFile=path.join(home,'.claude','settings.json');
let settings={};
if(fs.existsSync(settingsFile)){
 try{settings=JSON.parse(fs.readFileSync(settingsFile,'utf8'));}catch(e){throw Error(`Cannot parse ${settingsFile}. Not modifying it: ${e.message}`);}
}
if(!settings || typeof settings!=='object' || Array.isArray(settings))throw Error('Unexpected Claude settings format');
const marker='tokenshield.js" hook-session-start';
const cmd='node "'+path.join(install,'bin','tokenshield.js')+'" hook-session-start';
settings.hooks ??= {};
settings.hooks.SessionStart ??= [];
if(!Array.isArray(settings.hooks.SessionStart))throw Error('Unexpected SessionStart settings format');
settings.hooks.SessionStart=settings.hooks.SessionStart.filter(group=>!JSON.stringify(group).includes(marker));
settings.hooks.SessionStart.push({hooks:[{type:'command',command:cmd,timeout:10}]});
fs.mkdirSync(path.dirname(settingsFile),{recursive:true});
if(fs.existsSync(settingsFile))fs.copyFileSync(settingsFile,settingsFile+'.tokenshield-backup');
const temp=settingsFile+'.tokenshield-tmp';
fs.writeFileSync(temp,JSON.stringify(settings,null,2)+'\n',{mode:0o600});
fs.renameSync(temp,settingsFile);
console.log('TokenShield installed globally for Claude Code.');
console.log('Restart Claude Code in VS Code; then type /tokenshield to enable safe mode in that project.');
console.log('Use /tokenshield off or /tokenshield status as needed.');
console.log('Existing Claude settings backup: '+settingsFile+'.tokenshield-backup (if file existed).');
