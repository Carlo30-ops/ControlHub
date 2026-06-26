export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {deletePagesInput}=params;
  return await api.deletePages({input:inputPath,output:outputDir,pages:deletePagesInput});
}
