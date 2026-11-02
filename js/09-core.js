// Recuperación transparente del borrador de evaluación después de volver a iniciar sesión.
(function(){
  const originalOpenEvalModal = window.openEvalModal;
  if(false && typeof originalOpenEvalModal === 'function' && !window.__nmDraftRecoveryWrapped){
    window.openEvalModal = function(){
      const result = originalOpenEvalModal.apply(this, arguments);
      setTimeout(()=>{
        if(sessionStorage.getItem('nutri_eval_draft')){
          if(restoreEvaluationDraft()) notify?.('Se recuperaron los datos que habías escrito antes de vencer la sesión.', 'success');
        }
      },180);
      return result;
    };
    window.__nmDraftRecoveryWrapped=true;
  }
})();
