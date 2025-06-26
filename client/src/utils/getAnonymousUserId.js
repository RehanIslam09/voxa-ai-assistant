export const getAnonymousUserId = () => {
  let userId = localStorage.getItem('anonymous_user_id');

  if (!userId) {
    userId = crypto.randomUUID(); // built-in secure unique ID
    localStorage.setItem('anonymous_user_id', userId);
  }

  return userId;
};
