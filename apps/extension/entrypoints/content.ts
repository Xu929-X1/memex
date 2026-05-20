export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    //session related


    document.addEventListener("mouseup", () => {
      const text = window.getSelection()?.toString();
      if (text) {
        console.log(text);
      }
    });

    //browser related
    browser.storage.onChanged.addListener((changes) => {

    });
  },
});
