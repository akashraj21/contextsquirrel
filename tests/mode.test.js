import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getStatus,setMode,policyText} from '../src/mode.js';
test('Safe mode project-local toggle',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'contextsquirrel-mode-'));
 try{
 assert.equal(getStatus(root).enabled,false);
 assert.equal(setMode(root,'safe').mode,'safe');
 assert.equal(getStatus(root).enabled,true);
 assert.equal(setMode(root,'off').enabled,false);
 assert.match(policyText(),/SAFE MODE/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
