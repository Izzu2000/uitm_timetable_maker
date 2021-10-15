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
        this.__getCourses = this.__getCourses.bind(this);
        this.isInit = false;
        this.selectionData = [];
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

        this.courseSpinner = new PartialSpinner("Select Course", "Add Course", firstCell);
        this.courseSpinner.setClickListener(this.initiateCourse);
        this.courseSpinner.addSelectedListener(this.selectedCourse);
        this.groupSpinner = new PartialSpinner("Select Group", "-", secondCell);
        this.groupSpinner.addSelectedListener(this.selectedGroup);

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
    attachRow(node){
        let delCell = this.rowCourse.insertCell();
        delCell.appendChild(node);
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
        accumulator.execute(this.__getCourses);
    }
    async __getCourses(){
        this.courseSpinner.clearOptions();
        var cachedCourses = pageState["courses"];
        if (cachedCourses.length != 0){
            this.fillCourses(cachedCourses);
            return;
        }

        let payload = {branch: this.branch}
        let response = await fetch("/api/courses", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: {'Content-Type': 'application/json'}
        });
        let json = await response.json();
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
        creator.renderTable();
    }
    initSpinners(){
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
    renderTable(){
        var timetable = new Timetable();
        var alreadyFilled = new Set();
        var groups = [];
        currentCourses().forEach(course => {
            let courseName = course.courseValue();
            if (!alreadyFilled.has(courseName)){
                alreadyFilled.add(courseName);
                /* The reason we do this is to avoid duplicate data being rendered.
                    It is much easier to do this than disallowing user for adding the same
                    course. Nobody got time for that.
                */

                groups.push(new Group(course));
            }
        });
        
        let hasWeekend = groups.some(g => g.hasWeekend());
        timetable.addLocations(this.getDays(!hasWeekend));
        const maxHour = Math.max(18, ...groups.map(group => group.maxHour()));
        const minHour = Math.min(8, ...groups.map(group => group.minHour()));
        timetable.setScope(minHour, maxHour);

        groups.map(group => group.classes).flat().forEach(oneClass => {
            try{
                timetable.addEvent(oneClass.courseName, oneClass.day, oneClass.start, oneClass.end);
            }catch(err){
                console.log("Failure to add course '" + oneClass.courseName + "': " + err);
            }
        });

        var renderer = new Timetable.Renderer(timetable);
        renderer.draw('.timetable');
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
    createTH(header, "");
}
function createTable(){
    let table = document.getElementById("table_selection");
    table.setAttribute('class', 'table table-striped');
    createHeader(table);
    return table;
}
