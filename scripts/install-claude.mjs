#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const source=process.env.CONTEXTSQUIRREL_SOURCE || path.resolve(import.meta.dirname,'..');
const home=process.env.HOME || os.homedir();
const install=path.join(home,'.contextsquirrel','app');
if(path.resolve(source)===path.resolve(install))throw Error('Run installer from an extracted copy outside ~/.contextsquirrel/app');
fs.mkdirSync(path.dirname(install),{recursive:true});
fs.cpSync(source,install,{recursive:true,force:true,filter:(src)=>!src.split(path.sep).some(s=>['node_modules','.contextsquirrel','.git'].includes(s))});
const skillDir=path.join(home,'.claude','skills','squirrel');
fs.mkdirSync(skillDir,{recursive:true});
fs.copyFileSync(path.join(source,'integrations','claude-skill','SKILL.md'),path.join(skillDir,'SKILL.md'));

// Remove a prior TokenShield install so Claude Code doesn't keep two overlapping skills/hooks.
const oldSkillDir=path.join(home,'.claude','skills','tokenshield');
if(fs.existsSync(oldSkillDir))fs.rmSync(oldSkillDir,{recursive:true,force:true});
const oldApp=path.join(home,'.tokenshield','app');
if(fs.existsSync(oldApp))fs.rmSync(oldApp,{recursive:true,force:true});

const settingsFile=path.join(home,'.claude','settings.json');
let settings={};
if(fs.existsSync(settingsFile)){
 try{settings=JSON.parse(fs.readFileSync(settingsFile,'utf8'));}catch(e){throw Error(`Cannot parse ${settingsFile}. Not modifying it: ${e.message}`);}
}
if(!settings || typeof settings!=='object' || Array.isArray(settings))throw Error('Unexpected Claude settings format');
const markers=['contextsquirrel.js" hook-session-start','tokenshield.js" hook-session-start'];
const cmd='node "'+path.join(install,'bin','contextsquirrel.js')+'" hook-session-start';
settings.hooks ??= {};
settings.hooks.SessionStart ??= [];
if(!Array.isArray(settings.hooks.SessionStart))throw Error('Unexpected SessionStart settings format');
settings.hooks.SessionStart=settings.hooks.SessionStart.filter(group=>!markers.some(marker=>JSON.stringify(group).includes(marker)));
settings.hooks.SessionStart.push({hooks:[{type:'command',command:cmd,timeout:10}]});
fs.mkdirSync(path.dirname(settingsFile),{recursive:true});
if(fs.existsSync(settingsFile))fs.copyFileSync(settingsFile,settingsFile+'.contextsquirrel-backup');
const temp=settingsFile+'.contextsquirrel-tmp';
fs.writeFileSync(temp,JSON.stringify(settings,null,2)+'\n',{mode:0o600});
fs.renameSync(temp,settingsFile);
console.log('ContextSquirrel installed globally for Claude Code. \u{1F43F}️');
console.log('Restart Claude Code in VS Code; then type /squirrel to enable safe mode in that project.');
console.log('Use /squirrel off or /squirrel status as needed.');
console.log('Existing Claude settings backup: '+settingsFile+'.contextsquirrel-backup (if file existed).');
