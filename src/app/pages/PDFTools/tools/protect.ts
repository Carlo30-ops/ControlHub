export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {password}=params;
  return await api.protect({input:inputPath,output:outputDir,password});
}
