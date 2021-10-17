var pageState = {
    "rows": [], 
    "courses": [], 
    "groups": {},
    "group_selection": new Set()
};
function currentCourses(){
    return pageState["rows"].filter(e => e.initiated);
}
function selectedBranch(branch){
    console.log("Branch: " + branch)
    pageState["courses"] = [];
    pageState["groups"] = {};
    if ("table" in pageState){
        currentCourses().forEach(e => {
            console.log("branchupdate:" + branch);
            e.updateBranch(branch);
        });
        return;
    }else{
        pageState["table"] = createTable();
    }
    let course = createNewCourse(branch);
    course.initiateCourse();
}
function createNewCourse(branch){
    var table = pageState["table"];
    let course = new Course(branch, table);
    pageState["rows"].push(course);
    course.createRow();
    return course;
}

function updateAllCourses(callback){
    currentCourses().forEach(callback);
}
class BasicAccumulator{
    constructor(){
        this.functions = [];
        this.functionLock = false;
        this.executor = this.executor.bind(this);
        this.execute = this.execute.bind(this);
    }
    execute(callback){
        this.functions.push(callback);
        if (!this.functionLock)
            this.executor();
    }
    async executor(){
        this.functionLock = true;
        while(this.functions.length){
            var thisCallback = this.functions.pop();
            try{
                await thisCallback();
            }catch(error){
                console.log("Failure to call " + thisCallback + ": " + error.message);
            }
        }
        this.functionLock = false;
    }

}
var accumulator = new BasicAccumulator();
class Course {
    constructor(branch, table) {
        this.selectedGroupValues = this.selectedGroupValues.bind(this);
        this.groupValue = this.groupValue.bind(this);
        this.courseValue = this.courseValue.bind(this);
        this.selectedGroup = this.selectedGroup.bind(this);
        this.branch = branch;
        this.table = table;
        this.rowCourse = table.insertRow();
        this.groupSpinner = null;
        this.courseSpinner = null;
        this.selectedCourse = this.selectedCourse.bind(this);
        this.deleteCourse = this.deleteCourse.bind(this);
        this.attachRow = this.attachRow.bind(this);
        this.updateBranch = this.updateBranch.bind(this);
        this.initSpinners = this.initSpinners.bind(this);
        this.initDelete = this.initDelete.bind(this);
        this.initiateCourse = this.initiateCourse.bind(this);
        this.fillCourses = this.fillCourses.bind(this);
        this.fillGroups = this.fillGroups.bind(this);
        this.autoGroupAssume = this.autoGroupAssume.bind(this);
        this.unhighlight = this.unhighlight.bind(this);
        this.formatClass = this.formatClass.bind(this);
        this.__fetchCourses = this.__fetchCourses.bind(this);
        this.isInit = false;
        this.selectionData = [];
        this._groupValue = null;
        this._classes = null;
        this.classesNode = null;
        this._highlight = false;
    }
    get group(){
        if (this._groupValue !== this.groupValue() || this._classes == null)
            this._groupValue = this.groupValue();
            this._classes = new Group(this);

        return this._classes;
    }
    get isHighlighted(){
        return this._highlight;
    }
    highlight(){
        if (!this.isHighlighted)
            this.toggleHighlight();
    }
    unhighlight(){
        if(this.isHighlighted)
            this.toggleHighlight();
    }
    toggleHighlight(){
        this._highlight = !this._highlight;
        let color = this.isHighlighted? "red": "black";
        let tds = this.rowCourse.getElementsByTagName("td"); 

        for(var i = 0; i < tds.length; i++)
            tds[i].setAttribute("style", "color: " + color);

        console.log("toggle");
    }

    selectedGroupValues(){
        var value = this.groupValue();
        return this.selectionData.filter(e => e["Group"] == value);
    }
    updateBranch(branch){
        this.branch = branch;
        this.groupSpinner.clearOptions();
        this.getCourses();
    }

    get initiated(){
        return this.isInit;
    }
    initiateCourse(){
        this.isInit = true;
        this.groupSpinner.fullInitSpinner();
        this.initSpinners();
        createNewCourse(this.branch);
        this.courseSpinner.removeClickListener(this.initiateCourse);
    }
    createRow(){
        let row = this.rowCourse;

        let firstCell = row.insertCell();
        let secondCell = row.insertCell();
        
        let courseSpinner = new PartialSpinner("Select Course", "Add Course", firstCell);
        this.courseSpinner = courseSpinner;

        courseSpinner.setClickListener(this.initiateCourse);
        courseSpinner.addSelectedListener(this.selectedCourse);
        let groupSpinner = new PartialSpinner("Select Group", "-", secondCell);
        this.groupSpinner = groupSpinner;
        groupSpinner.addSelectedListener(this.selectedGroup);

        this.table.appendChild(row);
    }
    initDelete(){
        let delButton = document.createElement("button");
        delButton.innerHTML = "Delete";
        delButton.setAttribute("class", "btn btn-outline-danger");
        delButton.setAttribute("type", "button");
        delButton.onclick = this.deleteCourse;
        this.attachRow(delButton);
    }
    createClassRow(){
        let groupCell = document.createTextNode("");
        return this.attachRow(groupCell);
    }
    formatClass(){
        let classNode = this.classesNode;
        if (classNode == null){
            classNode = this.createClassRow();
            this.classesNode = classNode;
        }else
            while (classNode.hasChildNodes())
                classNode.removeChild(classNode.lastChild);

        const group = this.group;
        const texts = group.classes.map(e => e.day.slice(0, 3) + ": " + e.rawStart + " - " + e.rawEnd);
        if (texts.length != 0){
            texts.forEach(e => {
                let content = document.createTextNode(e);
                classNode.appendChild(content);
                let br = document.createElement("br");
                classNode.appendChild(br);
            });
        }else{
            let content = document.createTextNode("No class");
            classNode.appendChild(content);
        }
            
    }
    attachRow(node){
        let delCell = this.rowCourse.insertCell();
        delCell.appendChild(node);
        return delCell;
    }
    deleteCourse(){
        let arr = pageState["rows"];
        let index = arr.indexOf(this);
        if (index > -1)
            arr.splice(index, 1);
        this.table.removeChild(this.rowCourse);
        creator.renderTable();
    }
    fillCourses(data){
        for (var key in data)
            createOptionJson(this.courseSpinner, data[key]);
    }
    getCourses(){
        this.courseSpinner.clearOptions();
        var cachedCourses = pageState["courses"];
        if (cachedCourses.length != 0){
            this.fillCourses(cachedCourses);
            return;
        }

        accumulator.execute(async() => await this.__fetchCourses(cachedCourses));
    }
    async __fetchCourses(cachedCourses){
        let payload = {branch: this.branch}
        try{
            let response = await fetch("/api/courses", {
                method: "POST",
                body: JSON.stringify(payload),
                headers: {'Content-Type': 'application/json'}
            });
            var json = await response.json();
        }catch(err) {
            console.log("Failure getting courses " + this.branch + ":" + err);
            json = {};
        }
        for(var key in json)
            cachedCourses.push(json[key]);
        this.fillCourses(json);
    }
    courseValue(){
        return this.courseSpinner.value;
    }
    groupValue(){
        return this.groupSpinner.value;
    }
    fillGroups(data){
        let filled = [];
        for(var key in data){
            let rawData = data[key];
            if (rawData == null || !rawData.hasOwnProperty('Group'))
                continue;

            let value = rawData["Group"];
            if (!filled.includes(value)){
                filled.push(value);
                createOption(this.groupSpinner, value, value);
            }
            this.selectionData.push(rawData);
        }
        this.formatClass();
        this.autoGroupAssume();
    }
    autoGroupAssume(){
        let prevSelections = pageState["group_selection"];
        
        for(var i = 0; i < this.selectionData.length; i++){
            let group = this.selectionData[i]["Group"];
            if (prevSelections.has(group)){
                this.selectedGroup(group);
                break;
            }
        }
    }

    selectedCourse(value){
        let select = this.groupSpinner;
        select.clearOptions();
        this.selectionData = [];

        let cachedGroups = pageState["groups"][value];
        if(cachedGroups !== undefined && cachedGroups.length != 0){
            this.fillGroups(cachedGroups);
            return;
        }
        pageState["groups"][value] = []


        let payload = {
            branch: this.branch,
            course: value
        }
        fetch("/api/course", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json'
            }
        }).then(res => res.json())
        .then(json => {
            for(var key in json)
                pageState["groups"][value].push(json[key]);
            this.fillGroups(json);
        });
    }
    selectedGroup(val){
        this.groupSpinner.setValue(val);
        pageState["group_selection"].add(val);
        this.formatClass();
        creator.renderTable();
    }
    initSpinners(){
        this.formatClass();
        this.initDelete();
        this.getCourses();
    }
    createSelect(callback){
        var selectList = document.createElement("select");
        selectList.setAttribute('class', 'js-example-basic-single');
        selectList.onclick = callback;

        this.attachRow(selectList);
        return selectList;
    }

}

class TimeTableCreator{
    constructor(){
        this.renderTable = this.renderTable.bind(this);
    }
    getDays(noWeekend){
        let days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday"
        ];
        return noWeekend? days.slice(0, 5): days;
    }
    getAllGroups(){
        let alreadyFilled = new Set();
        let groups = [];
        currentCourses().forEach(course => {
            let courseName = course.courseValue();
            if (!alreadyFilled.has(courseName)){
                alreadyFilled.add(courseName);
                /* The reason we do this is to avoid duplicate data being rendered.
                    It is much easier to do this than disallowing user for adding the same
                    course. Nobody got time for that.
                */

                groups.push(course.group);
            }
        });
        return groups;
    }
    allClass(groups){
        return groups.map(group => group.classes).flat();
    }
    clashDetection(groups){
        let classes = [];
        let allClass = this.allClass(groups);
        updateAllCourses(e => e.unhighlight());
        
        allClass.forEach(oneClass => {
            let indexClash = classes.map(e => {
                if (e.course == oneClass.course || e.day != oneClass.day)
                    return false;

                let [start, end, cStart, cEnd] = [e.start, e.end, oneClass.start, oneClass.end];
                return (start <= cStart && cStart <= end) ||
                (start <= cEnd && cEnd <= end);
            }).indexOf(true);
            classes.push(oneClass);
            if (indexClash > -1){
                let clashClass = classes[indexClash];
                clashClass.course.highlight();
                oneClass.course.highlight();
                console.log("Clash = " + clashClass.course.courseValue() + " with " + oneClass.course.courseValue());
            }
        });
    }

    renderTable(){
        let timetable = new Timetable();
        let groups = this.getAllGroups();
        
        let hasWeekend = groups.some(g => g.hasWeekend());
        timetable.addLocations(this.getDays(!hasWeekend));
        this.clashDetection(groups);

        let maxHour = Math.max(...groups.map(group => group.maxHour()));
        let minHour = Math.min(...groups.map(group => group.minHour()));
        if (!isFinite(maxHour))  // max/min becomes infinity when there is no groups selected
            maxHour = 18;
        if (!isFinite(minHour))
            minHour = 8;

        timetable.setScope(minHour, maxHour);

        this.allClass(groups).forEach(oneClass => {
            try{
                let [course, options] = oneClass.formattedName();
                timetable.addEvent(course, oneClass.day, oneClass.start, oneClass.end, options);
            }catch(err){
                console.log("Failure to add course '" + oneClass.courseName + "': " + err);
            }
        });

        // dynamic timetable is not sync, as temporary solution, calculate it.
        var renderer = new Timetable.Renderer(timetable);
        const absoluteOffset = 50;
        let calculate = (offset) => ((maxHour - minHour) * 96) + offset + absoluteOffset;
        let tableElem = document.querySelector('.timetable');

        tableElem.setAttribute("style", "width: "  + calculate(0) + "px");

        renderer.draw('.timetable');
        let asideElem = tableElem.getElementsByTagName('aside')[0];
        let offset = asideElem.offsetWidth;
        tableElem.setAttribute("style", "width: "  + calculate(offset) + "px");
    }
}

var creator = new TimeTableCreator();
function createOptionJson(spinner, subj){
    return createOption(spinner, subj['course'], subj['name']);
}
function createOption(spinner, value, text){
    spinner.addOption(value, text)
}

function createTH(row, text){
    var thCell = document.createElement("th");
    thCell.innerHTML = text;
    thCell.scope = "col";
    row.appendChild(thCell);
}
function createHeader(table){
    let headerTH = table.createTHead();
    let header = headerTH.insertRow();
    createTH(header, "Course");
    createTH(header, "Group");
    createTH(header, "Time");
    createTH(header, "");
}
function createTable(){
    let table = document.getElementById("table_selection");
    table.setAttribute('class', 'table table-striped');
    createHeader(table);
    return table;
}
