/** Two-sided, probability-ordered Fisher exact test. No asymptotic approximation. */
export interface ExactPValue { logPValue:number; pValue:number|null }
const maximumTotal=100000;
const orderingBand=1e-8;
let primeCache: number[]|undefined;
function primes() {
  if(primeCache)return primeCache;
  const composite=new Uint8Array(maximumTotal+1),result:number[]=[];
  for(let p=2;p<=maximumTotal;p++)if(!composite[p]){
    result.push(p);if(p*p<=maximumTotal)for(let m=p*p;m<=maximumTotal;m+=p)composite[m]=1;
  }
  primeCache=result;return result;
}
function factorialPower(n:number,p:number){let power=0;while(n){n=Math.floor(n/p);power+=n;}return power;}

/** Exact integer fallback for probability ties and near ties, bounded by n<=100000. */
export function exactHypergeometricMassOrder(n:number,k:number,r:number,left:number,right:number):number {
  const lo=Math.max(0,r+k-n),hi=Math.min(r,k);
  if(![n,k,r,left,right].every(Number.isSafeInteger)||n<0||n>maximumTotal||k<0||k>n||r<0||r>n||left<lo||left>hi||right<lo||right>hi)throw Error('Invalid bounded hypergeometric support.');
  if(left===right||k*2===n&&left+right===r||r*2===n&&left+right===k)return 0;
  let numerator=1n,denominator=1n;
  if(Math.abs(left-right)<=32){
    for(let x=Math.min(left,right);x<Math.max(left,right);x++){
      const up=BigInt((r-x)*(k-x)),down=BigInt((x+1)*(n-r-k+x+1));
      numerator*=left>right?up:down;denominator*=left>right?down:up;
    }
  }else{
    // Common k! and (n-k)! terms cancel. Compare integer prime products rather
    // than trusting a rounded log probability to decide a tail boundary.
    for(const p of primes()){
      if(p>n)break;
      const exponent=[right,k-right,r-right,n-k-r+right].reduce((sum,v)=>sum+factorialPower(v,p),0)
        -[left,k-left,r-left,n-k-r+left].reduce((sum,v)=>sum+factorialPower(v,p),0);
      if(exponent>0)numerator*=BigInt(p)**BigInt(exponent);
      else if(exponent<0)denominator*=BigInt(p)**BigInt(-exponent);
    }
  }
  return numerator===denominator?0:numerator<denominator?-1:1;
}
function logSum(values:Float64Array,include?:Uint8Array){
  let max=-Infinity;for(let i=0;i<values.length;i++)if(!include||include[i])max=Math.max(max,values[i]);
  let sum=0,compensation=0;
  for(let i=0;i<values.length;i++)if(!include||include[i]){const term=Math.exp(values[i]-max)-compensation,next=sum+term;compensation=(next-sum)-term;sum=next;}
  return max+Math.log(sum);
}
export function fisherExactTwoSided(table:readonly[number,number,number,number]):ExactPValue {
  if(table.length!==4||!table.every(v=>Number.isSafeInteger(v)&&v>=0)||table.reduce((s,v)=>s+v,0)>maximumTotal)throw Error('Fisher tests require four nonnegative integer counts totaling at most 100,000.');
  const[a,b,c,d]=table,n=a+b+c+d,r=a+b,k=a+c,lo=Math.max(0,r+k-n),hi=Math.min(r,k);
  if(lo===hi)return{logPValue:0,pValue:1};
  const mode=Math.min(hi,Math.max(lo,Math.floor((r+1)*(k+1)/(n+2)))),logs=new Float64Array(hi-lo+1);
  for(let x=mode;x<hi;x++)logs[x+1-lo]=logs[x-lo]+Math.log(((r-x)*(k-x))/((x+1)*(n-r-k+x+1)));
  for(let x=mode;x>lo;x--)logs[x-1-lo]=logs[x-lo]+Math.log((x*(n-r-k+x))/((r-x+1)*(k-x+1)));
  const observed=logs[a-lo],included=new Uint8Array(logs.length);
  for(let x=lo;x<=hi;x++){
    const difference=logs[x-lo]-observed;
    if(difference < -orderingBand || Math.abs(difference)<=orderingBand&&exactHypergeometricMassOrder(n,k,r,x,a)<=0)included[x-lo]=1;
  }
  const logPValue=Math.min(0,logSum(logs,included)-logSum(logs));
  if(!Number.isFinite(logPValue))throw Error('The exact-test probability could not be represented reliably. No statistical conclusion was accepted.');
  return {logPValue,pValue:logPValue<Math.log(1e-300)?null:Math.exp(logPValue)};
}

/** Holm step-down Bonferroni across the complete selected family. */
export function holmLogPValues(values:readonly number[]):number[]{
  if(!values.length||values.length>20||!values.every(v=>Number.isFinite(v)&&v<=0))throw Error('Choose a family of 1–20 valid log probabilities.');
  const ordered=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index),adjusted=Array<number>(values.length);let previous=-Infinity;
  ordered.forEach(({value,index},rank)=>{previous=Math.max(previous,Math.min(0,value+Math.log(values.length-rank)));adjusted[index]=previous;});return adjusted;
}
export function probabilityLabel(logPValue:number|null):string{
  if(logPValue===null)return 'Unavailable';if(!Number.isFinite(logPValue)||logPValue>0)throw Error('Invalid displayed log probability.');
  if(logPValue<Math.log(1e-300))return '<1e-300';const value=Math.exp(logPValue);return value<0.0001?value.toExponential(3):value.toPrecision(4);
}
export function thresholdDecision(logPValue:number|null,alpha:number):'below'|'above'|'boundary'|'unavailable'{
  if(!Number.isFinite(alpha)||alpha<0.001||alpha>0.2)throw Error('Choose alpha from 0.001 through 0.2.');
  if(logPValue===null)return 'unavailable';if(!Number.isFinite(logPValue)||logPValue>0)throw Error('Invalid decision probability.');
  const distance=logPValue-Math.log(alpha);return Math.abs(distance)<=1e-10?'boundary':distance<0?'below':'above';
}
