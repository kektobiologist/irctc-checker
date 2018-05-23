import React, { Component } from "react";
import logo from "./logo.svg";
import "./App.css";
import Autocomplete from "react-autocomplete";
import moment from "moment";
import ReconnectingWebSocket from "reconnecting-websocket";
import WebSocketClient from "./WebSocketClient";
import BootstrapTable from "react-bootstrap-table-next";
import DatePicker from "react-16-bootstrap-date-picker";
import Autosuggest from "./Autosuggest";
import {
  ProgressBar,
  Row,
  Col,
  FormGroup,
  FormControl,
  PageHeader
} from "react-bootstrap";

const menuStyle = {
  borderRadius: "3px",
  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.1)",
  background: "rgba(255, 255, 255, 0.9)",
  padding: "2px 0",
  fontSize: "90%",
  position: "fixed",
  overflow: "auto",
  maxHeight: "50%", // TODO: don't cheat, let it flow to the bottom
  zIndex: 100
};

class App extends Component {
  state = {
    ac: [],
    date: moment(new Date())
      .add(7, "days")
      .toISOString(),
    sourceStation: "NEW DELHI - NDLS",
    destinationStation: "LUCKNOW NR - LKO",
    infoMessage: "",
    trains: [],
    disabled: false,
    numFetches: 0
  };
  onButtonClicked = () => {
    fetch("/api/solveCaptcha")
      .then(res => res.json())
      .then(txt => this.setState({ txt }));
  };

  createWebsocket = clientId => {
    var ws = new WebSocket(`ws://localhost:3000/api?id=${clientId}`);
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
          this.setState({
            trains: this.state.trains.concat([JSON.parse(message.data)])
          });
          break;
        case "numFetches":
          this.setState({
            numFetches: parseInt(message.data)
          });
          break;
        case "done":
          this.setState({ disabled: false });
          break;
        case "error":
          console.log(message.data);
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
        console.log(ac);
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
      trains: []
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
      disabled
    } = this.state;
    const columns = [
      {
        dataField: "trainNo",
        text: "Train No"
      },
      {
        dataField: "trainName",
        text: "Train Name"
      },
      {
        dataField: "classc",
        text: "Class"
      },
      {
        dataField: "availablityStatus",
        text: "Availability"
      },
      {
        dataField: "totalCollectibleAmount",
        text: "Fare (Rs.)"
      }
    ];
    var progressValue = numFetches ? trains.length / numFetches * 100 : 0;
    return (
      <div className="App container">
        <PageHeader>IRCTC Availability Checker</PageHeader>
        <p>{txt}</p>
        <div className="form-group">
          <div className="row">
            <div className="col">
              {/*<input
                className="form-control"
                type="date"
                value={this.state.date}
                onChange={e => this.setState({ date: e.target.value })}
              />*/}
              <DatePicker
                id="dp"
                value={this.state.date}
                onChange={date => this.setState({ date })}
              />
              {/*<SingleDatePicker
              date={this.state.date} // momentPropTypes.momentObj or null
              onDateChange={date => this.setState({ date })} // PropTypes.func.isRequired
              focused={this.state.focused} // PropTypes.bool
              onFocusChange={({ focused }) => this.setState({ focused })} // PropTypes.func.isRequired
              id="your_unique_id" // PropTypes.string.isRequired,
            />*/}
            </div>
            <div className="col">
              <Autosuggest
                suggestions={this.getFilteredList(ac, sourceStation)}
                value={this.state.sourceStation}
                onChange={sourceStation => this.setState({ sourceStation })}
              />
              {/* <Autocomplete
                getItemValue={item => item}
                items={this.getFilteredList(ac, sourceStation)}
                renderItem={this.renderItem}
                value={this.state.sourceStation}
                onChange={e => this.setState({ sourceStation: e.target.value })}
                onSelect={val => this.setState({ sourceStation: val })}
                menuStyle={menuStyle}
              />*/}
            </div>
            <div className="col">
              <Autosuggest
                suggestions={this.getFilteredList(ac, destinationStation)}
                value={this.state.destinationStation}
                onChange={destinationStation =>
                  this.setState({ destinationStation })}
              />
              {/*<Autocomplete
                getItemValue={item => item}
                items={this.getFilteredList(ac, destinationStation)}
                renderItem={this.renderItem}
                value={this.state.destinationStation}
                onChange={e =>
                  this.setState({ destinationStation: e.target.value })}
                onSelect={val => this.setState({ destinationStation: val })}
                menuStyle={menuStyle}
              />*/}
            </div>
            <div className="col">
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
          <div className="col">{infoMessage}</div>
        </div>
        <div className="row">
          <div className="col">
            {/*<div className="progress">
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${progressValue}%` }}
                aria-valuenow={progressValue}
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>*/}
            <ProgressBar now={progressValue} />
          </div>
        </div>
        <div className="row">
          <div className="col">
            <BootstrapTable
              keyField="id"
              data={trains.map(train => {
                return {
                  ...train,
                  id: train.trainNo + train.classc,
                  availablityStatus: train.avlDayList
                    ? train.avlDayList[0].availablityStatus
                    : "UNKNOWN"
                };
              })}
              columns={columns}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
