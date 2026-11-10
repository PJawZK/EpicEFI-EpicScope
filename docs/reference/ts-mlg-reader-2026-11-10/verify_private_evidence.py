"""Read-only, SHA-pinned disassembly checks. Private javap output stays outside Git.
Usage: python verify_private_evidence.py ORIGINAL_JAR /absolute/private/output
No vendor classes are loaded or executed by this script.
"""
import hashlib,json,pathlib,re,subprocess,sys,zipfile
JAR_SHA='3ebafb867fef3722816e768879501845904f81bc5e13249c77d170e9adf61cf8'
classes=['MegaLogViewer','ao.cd','ao.aX','g.b','W.W','W.X','h.b','h.c','h.d','ak.ao','ak.aq','ak.ar','bH.c']
jar=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve()
repo=pathlib.Path(__file__).resolve().parents[3]
if out==repo or repo in out.parents:raise SystemExit('Private bytecode output must be outside the EpicScope checkout')
assert hashlib.sha256(jar.read_bytes()).hexdigest()==JAR_SHA,'Original JAR identity mismatch'
out.mkdir(parents=True,exist_ok=True);texts={};identities={}
with zipfile.ZipFile(jar) as z:
 for c in classes:
  b=z.read(c.replace('.','/')+'.class');identities[c]=hashlib.sha256(b).hexdigest()
  t=subprocess.run(['java','-m','jdk.jdeps/com.sun.tools.javap.Main','-c','-p','-s','-classpath',str(jar),c],check=True,capture_output=True,text=True).stdout
  (out/(c+'.javap')).write_text(t);texts[c]=t
clock=texts['ak.ao'].split('  private long c(int);',1)[1].split('  private byte[]',1)[0]
assert re.search(r'21:\s+if_icmple\s+46',clock),'Non-increasing branch changed'
assert 'double 16.0d' in clock and 'double 10.0d' in clock and 'putfield' in clock
assert 'float 1000000.0f' in texts['ak.ar'] and 'fdiv' in texts['ak.ar']
assert re.search(r'1083:\s+ifne\s+1149',texts['ak.ao']) and 'String Time' in texts['ak.ao']
assert 'class ak/ao' in texts['h.b'] and 'Method W/W.a:(Ljava/lang/String;Ljava/lang/Class;)V' in texts['h.b']
assert 'String .mlg' in texts['W.X'] and 'Method W/V.c:()[F' in texts['g.b']
assert 'CRC does not match' in texts['ak.ao'] and 'i2b' in texts['ak.ao']
result={'originalJarSha256':JAR_SHA,'classSha256':identities,'checksPassed':7,'scope':'Pinned disassembly identities and selected instruction predicates; semantic findings require the accompanying report. No vendor runtime execution.'}
(out/'verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
