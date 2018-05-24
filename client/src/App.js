import React, { Component } from "react";
import logo from "./logo.svg";
import "./App.css";
import Autocomplete from "react-autocomplete";
import moment from "moment";
import BootstrapTable from "react-bootstrap-table-next";
import DatePicker from "react-16-bootstrap-date-picker";
import Autosuggest from "./Autosuggest";
import {
  ProgressBar,
  Row,
  Col,
  FormGroup,
  FormControl,
  PageHeader,
  Checkbox
} from "react-bootstrap";

import ac from "./ac.json";
import { menuStyle, classes, columns } from "./constants";

class App extends Component {
  state = {
    ac,
    date: moment(new Date())
      // .add(7, "days")
      .toISOString(),
    currentQueryDate: null,
    sourceStation: "",
    destinationStation: "",
    infoMessage: "",
    trains: [],
    disabled: false,
    numFetches: 0,
    classCheckboxes: classes.map(() => true),
    showWaitlist: false
  };
  onButtonClicked = () => {
    fetch("/api/solveCaptcha")
      .then(res => res.json())
      .then(txt => this.setState({ txt }));
  };

  createWebsocket = clientId => {
    var ws = new WebSocket(
      `${window.location.protocol != "https:" ? "ws" : "wss"}://${window
        .location.hostname}:${window.location.port}/api?id=${clientId}`
    );
    ws.onopen = e => {
      console.log("WebSocketClient connected:", e);
      // this.send("Hello World !");
    };
    ws.onmessage = evt => {
      // add the new message to state
      var message = JSON.parse(evt.data);
      switch (message.type) {
        case "info":
          this.setState({ infoMessage: message.data });
          break;
        case "train":
          // make sure this train has correct availablity shit, only then add
          const { currentQueryDate } = this.state;
          const formattedDate = moment(currentQueryDate).format("D-M-YYYY");
          var train = JSON.parse(message.data);
          if (train.avlDayList) {
            var avlInfo = train.avlDayList.find(
              ({ availablityDate }) => availablityDate == formattedDate
            );
            if (avlInfo) {
              train = { ...train, ...avlInfo };
              this.setState({
                trains: this.state.trains.concat([train])
              });
            }
          }
          break;
        case "numFetches":
          this.setState({
            numFetches: parseInt(message.data)
          });
          break;
        case "done":
          const { trains } = this.state;
          var numAvailable = trains.filter(
            train => train.availablityType == "1"
          ).length;
          var numWaiting = trains.filter(
            train =>
              train.availablityType == "2" || train.availablityType == "3"
          ).length;
          this.setState({
            disabled: false,
            infoMessage: `Found ${numAvailable} Available, ${numWaiting} Waiting List.`
          });
          break;
        case "error":
          console.log(message.data);
          this.setState({ disabled: false, infoMessage: message.data });
          break;
      }
    };

    ws.onclose = e => {
      console.log("Websocket closed", e);
      setTimeout(() => {
        var ws = this.createWebsocket(clientId);
        this.setState({ ws });
      }, 2000);
    };
    return ws;
  };
  componentDidMount() {
    fetch("/api/fetchAutoComplete")
      .then(res => res.json())
      .then(ac => {
        this.setState({ ac });
      });
    // get a unique client id
    var clientId = Math.random()
      .toString(36)
      .substring(7);
    var ws = this.createWebsocket(clientId);
    this.setState({ ws, clientId });
  }

  getFilteredList = (items, value) => {
    return items
      .filter(item => {
        return item.toLowerCase().indexOf(value.toLowerCase()) !== -1;
      })
      .slice(0, 50);
  };

  onGetTrainsClicked = () => {
    const { date, sourceStation, destinationStation, clientId } = this.state;
    this.setState({
      disabled: true,
      numFetches: 0,
      trains: [],
      currentQueryDate: date,
      infoMessage: "Connecting..."
    });
    fetch("/api/getTrains", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        date,
        sourceStation,
        destinationStation,
        clientId
      })
    });
  };

  renderItem = (item, isHighlighted) => (
    <div
      style={{
        background: isHighlighted ? "lightgray" : "white"
      }}
      key={item}
    >
      {item}
    </div>
  );

  render() {
    const {
      txt,
      ac,
      sourceStation,
      destinationStation,
      infoMessage,
      numFetches,
      trains,
      disabled,
      date,
      classCheckboxes,
      showWaitlist
    } = this.state;

    const allowedClasses = classes.filter(
      (classc, idx) => classCheckboxes[idx]
    );

    const allowedAvailablityTypes = showWaitlist ? ["1", "2", "3"] : ["1"];
    return (
      <div className="App container">
        <PageHeader>IRCTC Availability Checker</PageHeader>
        <p>{txt}</p>
        <div className="form-group">
          <div className="row">
            <div className="col-12 col-md-3 py-1">
              <DatePicker
                id="dp"
                minDate={moment().toISOString()}
                dateFormat={"DD-MM-YYYY"}
                value={this.state.date}
                onChange={date => this.setState({ date })}
              />
            </div>
            <div className="col-12 col-md-auto py-1">
              <Autosuggest
                suggestions={this.getFilteredList(ac, sourceStation)}
                value={this.state.sourceStation}
                onChange={sourceStation => this.setState({ sourceStation })}
                placeholder={"From"}
              />
            </div>
            <div className="col-12 col-md-auto py-1">
              <Autosuggest
                suggestions={this.getFilteredList(ac, destinationStation)}
                value={this.state.destinationStation}
                onChange={destinationStation =>
                  this.setState({ destinationStation })}
                placeholder={"To"}
              />
            </div>
            <div className="col-12 col-md-auto py-2">
              <button
                className="btn btn-primary"
                disabled={disabled}
                onClick={this.onGetTrainsClicked}
              >
                Get Availability
              </button>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col pb-3 text-muted">
            <i>{infoMessage}</i>
          </div>
        </div>
        <div className="row">
          <div className="col">
            <ProgressBar
              now={numFetches ? trains.length / numFetches * 100 : 0}
            />
          </div>
        </div>
        {numFetches ? (
          <div className="row">
            {classes.map((str, idx) => (
              <div className="col-auto" key={str}>
                <Checkbox
                  checked={classCheckboxes[idx]}
                  onChange={e => {
                    var classCheckboxes = { ...this.state.classCheckboxes };
                    classCheckboxes[idx] = e.target.checked;
                    this.setState({ classCheckboxes });
                  }}
                >
                  {str}
                </Checkbox>
              </div>
            ))}
            <div className="col-auto ml-auto">
              <Checkbox
                checked={showWaitlist}
                onChange={e =>
                  this.setState({ showWaitlist: e.target.checked })}
              >
                Show Waitlist
              </Checkbox>
            </div>
          </div>
        ) : (
          ""
        )}

        <div className="row">
          <div className="col">
            {numFetches ? (
              <BootstrapTable
                keyField="id"
                data={trains
                  // filter available/wl
                  .filter(train =>
                    allowedAvailablityTypes.find(
                      availablityType =>
                        train.availablityType == availablityType
                    )
                  )
                  // filter by classes
                  .filter(train =>
                    allowedClasses.find(classc => train.classc == classc)
                  )
                  .map(train => {
                    return {
                      ...train,
                      id: train.trainNo + train.classc
                    };
                  })}
                columns={columns}
              />
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default App;
