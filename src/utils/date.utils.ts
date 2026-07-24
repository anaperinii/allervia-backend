export const addDate = (date: Date, addNumber: number): Date => {
  const newDate = new Date();
  newDate.setDate(date.getDate() + addNumber);
  return newDate;
};
