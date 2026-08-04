// User ID is used to store the selected card ID and current SGD balance
export function selectedCardStorageKey(userId: string): string {
    return `nets_selected_card_id_${userId}`;
  }
  
  export function currentSgdBalanceStorageKey(userId: string): string {
    return `nets_current_sgd_balance_${userId}`;
  }
