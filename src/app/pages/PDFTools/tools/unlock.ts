export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {password}=params;
  return await api.unlock({input:inputPath,output:outputDir,password});
}
