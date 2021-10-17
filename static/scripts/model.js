class Class{
    constructor(course, json){
        this.course = course;
        this.toDate = this.toDate.bind(this);

        this.rawStart = json["Start"];
        this.rawEnd = json["End"];
        console.log(this.rawStart + " : " + this.rawEnd);
        let start = this.toDate(this.rawStart);
        let end = this.toDate(this.rawEnd);
        let [newStart, newEnd] = this.inferenceTime(start, end);

        this.start = newStart;
        this.end = newEnd;

        this.courseName = course.courseValue();
        this.day = json["Day"];
        this.status = json["Status"];
        this.mode = json["Mode"];
        this.room = json["Room"];
    }
    formattedName(){
        let course = this.courseName;

        let options = {
            rows: [
                this.rawStart + " - " + this.rawEnd
            ],
            style:{
                "background-color": this.course.color
            }
        };
        
        if (this.room !== "")
            options.rows.push(this.room);

        return [course, options];

    }
    toDate(time){
        /*
        The problem with uitm time given is that, they are unreliable
        They use both 24 and 12 hour time, which is confusing
        Possibility of data would be
            13:00pm (would break the regular date parse)
            12:00am (referring to 12:00pm, there are no classes at 12 midnight lol)
            3:5 pm  (this is also possible, i have to change my regex to match this)
        With this in mind, the function is to:
            - convert 12 to 12:00 regardless of pm/am
            - convert 1pm or 1am to 13:00 (not logical for classes to be at night)

            if hour 1 - 6, they would be 13 - 18
            if hour 8 - 12 or 0, they would be 8 - 12

        I wasn't sure to do this client side or server side, i decided to do it in client side
        because it's the client responsibility to interpret this data.
        */
        var grouper = /^((?<hour>[01]?[0-9]|2[0-3])):(?<min>(([0-5]\d)?|\d))( )*(?<day>(am|pm))$/.exec(time);
        const {groups: {hour, min, day}} = grouper;
        var date = new Date();
        var currentHour = parseInt(hour);
        var currentMinute = parseInt(min);
        if (currentHour <= 6 && currentHour > 0)
            currentHour += 12;
        else if (currentHour == 0)
            currentHour = 12;

        date.setHours(currentHour);
        date.setMinutes(currentMinute);
        date.setSeconds(0);
        return date;
    }
    inferenceTime(start, end){
        /*
        Another problem encountered with time is that, some class actually do goes above 6pm
        so we need both start and end time to inference correctly.
        
        Example inference
        4pm - 9am -> 4pm - 9pm
        */
        let startHour = start.getHours();
        let endHour = end.getHours();

        if (startHour == endHour) // validity check
            throw new Error('Unable to inference time correctly');

        if (startHour > endHour){  // ex. 4pm - 9am
            if (startHour == 0) // ex. 12am (not possible) -> 12pm
                start.setHours(12);
            else  // ex. 1am -> 1pm
                end.setHours(endHour + 12);
        }

        return [start, end];
    }
}

class Group{
    constructor(course){
        this.course = course;
        this.groupValues = course.selectedGroupValues();
        this.formatJson = this.formatJson.bind(this);
        this.range = [];
        this.classes = this.groupValues.map(this.formatJson);
    }
    formatJson(json){
        return new Class(this.course, json);
    }
    getAllHours(){
        return this.classes.map(e => {
            let start = e.start;
            let end = e.end;
            let endTime = end.getHours() + (end.getMinutes() > 0);
            return [start.getHours(), endTime];
        });
    }
    maxHour(){
        return Math.max(...this.getAllHours().flat());
    }
    minHour(){
        return Math.min(...this.getAllHours().flat());
    }
    hasWeekend(){
        console.log(this.classes.map(e => e.day.toLowerCase()));
        return this.classes.map(e => e.day.toLowerCase()).includes("saturday", "sunday");
    }
}