export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  return await api.repair({input:inputPath,output:outputDir});
}
