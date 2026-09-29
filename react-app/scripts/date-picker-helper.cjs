// Exercise the public controls rather than injecting dates into React state.
exports.pickDate = async (page, date) => {
  const [year, month] = date.split("-");
  await page.getByRole("button", { name: /^日期 / }).click();
  await page.getByRole("button", { name: "切换年月", exact: true }).click();
  await page.getByLabel("年份", { exact: true }).fill(year);
  await page
    .getByRole("group", { name: "月份", exact: true })
    .getByRole("button", { name: `${Number(month)}月`, exact: true })
    .click();
  await page.locator(`.date-picker button[data-date="${date}"]`).click();
};
