/**
 * Production prep gate: a failed SFX subprocess is a render failure, not
 * an indefinitely stuck "rendering" status. Do not retry blindly here.
 */
export async function runSfxPreparation({execute,onFailure}) {
  if(typeof execute!=="function"||typeof onFailure!=="function")
    throw Error("SFX preparation requires execution and failure-status callbacks.");
  try {
    const result=await execute();
    if(result?.error)throw result.error;
    if(result?.status!==0)
      throw Error("Не удалось подготовить звуковые эффекты: "+
        String(result?.stderr||result?.stdout||"unknown SFX subprocess failure"));
    return result;
  } catch(error) {
    // Persistence is required for agents to diagnose/recover the root cause.
    await onFailure(error);
    throw error;
  }
}
