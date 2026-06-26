export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {compressLevel}=params;
  return await api.compress({input:inputPath,output:outputDir,level:compressLevel});
}
