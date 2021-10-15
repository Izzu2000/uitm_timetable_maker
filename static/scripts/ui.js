class PartialSpinner{
    constructor(placeholder, placeholderUninit, binder){
        this.placeholder = placeholder;
        this.placeholderUninit = placeholderUninit;
        this.binder = binder;
        this.selectionContainer = null;
        this.optionsContainer = null;
        this.placeholderContainer = null;
        this.searchBarContainer = null;
        this.searchBar = null;
        this.filterList = this.filterList.bind(this);
        this.createDiv = this.createDiv.bind(this);
        this.fullInitSpinner = this.fullInitSpinner.bind(this);
        this.initSearch = this.initSearch.bind(this);
        this.selectListeners = [];
        this.isPartial = true;
        this.partialInitSpinner();
    }
    createDiv(className, bind){
      let container = document.createElement("div");
      container.setAttribute("class", className);

      bind.appendChild(container);
      return container;

    }
    partialInitSpinner(){
        let mainContainer = this.createDiv("select-box", this.binder);
        this.mainContainer = mainContainer;
        let selectionContainer = this.createDiv("selection-box", mainContainer);
        this.selectionContainer = selectionContainer;
        this.optionsContainer = this.createDiv("options-container", selectionContainer);
        this.placeholderContainer = this.createDiv("selected", mainContainer);
        this.placeholderContainer.innerHTML = this.placeholderUninit;

        this.setClickListener(this.fullInitSpinner);
    }
    removeClickListener(callback){
        this.placeholderContainer.removeEventListener("click", callback);
    }
    fullInitSpinner(){
        if (!this.isPartial)
            return;

        this.isPartial = false;
        this.placeholderContainer.innerHTML = this.placeholder;

        this.removeClickListener(this.fullInitSpinner);
        this.setDefaultListener();
        this.initSearch();
    }
    initSearch(){
        this.searchBarContainer = this.createDiv("search-box", this.selectionContainer);
        let inputBar = document.createElement("input");
        this.searchBar = inputBar;
        inputBar.setAttribute("type", "text");
        inputBar.setAttribute("placeholder", "Search");
        this.searchBarContainer.appendChild(inputBar);
        inputBar.addEventListener("keyup", e => this.filterList(e.target.value));

    }
    setDefaultOptionClickListener(option){
        option.addEventListener("click", e => {
            e.preventDefault();
            var valueSelect = option.querySelector("label").innerHTML;
            this.placeholderContainer.innerHTML = valueSelect;
            this.optionsContainer.classList.remove("active");
            this.selectListeners.forEach(e => e(valueSelect));
        });
    }
    addSelectedListener(callback){
        this.selectListeners.push(callback);
    }
    setDefaultListener(){
        let callback = () => {
            this.optionsContainer.classList.toggle("active");
            this.searchBar.value = "";
            this.filterList("");
            if (this.optionsContainer.classList.contains("active"))
                this.searchBar.focus();

        };
      this.setClickListener(callback);
    }
    filterList(query){
        var searchTerm = query.toLowerCase().trim();
        this.optionsContainer.childNodes.forEach(option => {
            let label = option.firstElementChild.nextElementSibling.innerText.toLowerCase().trim();
            if (label.indexOf(searchTerm) != -1)
                option.style.display = "block";
            else 
                option.style.display = "none";
            
      });
    }
    setClickListener(callback){
        this.placeholderContainer.addEventListener("click", callback);
    }

    get value(){
        return this.placeholderContainer.innerHTML;
    }
    addOption(value, placeholder){
        let optionContainer = this.createDiv("option", this.optionsContainer);

        let inputValue = document.createElement("input");
        inputValue.setAttribute("type", "radio");
        inputValue.setAttribute("class", "radio");
        inputValue.setAttribute("id", value);
        inputValue.setAttribute("name", this.placeholder);

        let labelValue = document.createElement("label");
        labelValue.setAttribute("for", value);
        labelValue.innerHTML = placeholder;

        optionContainer.appendChild(inputValue);
        optionContainer.appendChild(labelValue);
        this.setDefaultOptionClickListener(optionContainer);

        this.optionsContainer.appendChild(optionContainer);
    }
    clearOptions(){
        this.placeholderContainer.innerHTML = this.placeholder;
        let node = this.optionsContainer;
        while (node.firstChild)
            node.removeChild(node.lastChild);
    }
    setValue(value){
        this.placeholderContainer.innerHTML = value;
    }
  }

class Spinner extends PartialSpinner{
    constructor(placeholder, binder){
        super(placeholder, "", binder);
        this.fullInitSpinner();
    }
}
