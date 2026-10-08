export const addDate = (date: Date, addNumber: number): Date => {
  const newDate = new Date(date.getTime());
  newDate.setDate(newDate.getDate() + addNumber);
  return newDate;
};
