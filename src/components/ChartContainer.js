import React, { useState, useRef, forwardRef, useImperativeHandle } from "react";
import PropTypes from "prop-types";
import html2canvas from "html2canvas";
import jsPDF from 'jspdf'
import ChartNode from "./ChartNode";
import "./ChartContainer.css";

const propTypes = {
  datasource: PropTypes.object.isRequired,
  pan: PropTypes.bool,
  zoom: PropTypes.bool,
  zoomoutLimit: PropTypes.number,
  zoominLimit: PropTypes.number,
  containerClass: PropTypes.string,
  chartClass: PropTypes.string,
  nodeTemplate: PropTypes.elementType
};

const defaultProps = {
  pan: false,
  zoom: false,
  zoomoutLimit: 0.5,
  zoominLimit: 7,
  containerClass: "",
  chartClass: ""
};

const ChartContainer = forwardRef(({ datasource, pan, zoom, zoomoutLimit, zoominLimit, containerClass, chartClass, nodeTemplate }, ref) => {

  const startX = 0;
  const startY = 0;
  const container = useRef();
  const chart = useRef();
  const downloadButton = useRef();

  const [transform, setTransform] = useState("");
  const [panning, setPanning] = useState(false);
  const [cursor, setCursor] = useState("default");
  const [exporting, setExporting] = useState(false);
  const [dataURL, setDataURL] = useState("");
  const [download, setDownload] = useState("");

  const attachRel = (data, flags) => {
    var that = this;
    data.relationship =
      flags + (data.children && data.children.length > 0 ? 1 : 0);
    if (data.children) {
      data.children.forEach(function (item) {
        attachRel(item, "1" + (data.children.length > 1 ? 1 : 0));
      });
    }
    return data;
  }

  const panEndHandler = () => {
    this.setState({ panning: false, cursor: "default" });
  };

  const panHandler = (e) => {
    let newX = 0;
    let newY = 0;
    if (!e.targetTouches) {
      // pand on desktop
      newX = e.pageX - this.startX;
      newY = e.pageY - this.startY;
    } else if (e.targetTouches.length === 1) {
      // pan on mobile device
      newX = e.targetTouches[0].pageX - this.startX;
      newY = e.targetTouches[0].pageY - this.startY;
    } else if (e.targetTouches.length > 1) {
      return;
    }
    if (this.state.transform === "") {
      if (this.state.transform.indexOf("3d") === -1) {
        this.setState({
          transform: "matrix(1,0,0,1," + newX + "," + newY + ")"
        });
      } else {
        this.setState({
          transform:
            "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0," + newX + ", " + newY + ",0,1)"
        });
      }
    } else {
      let matrix = this.state.transform.split(",");
      if (this.state.transform.indexOf("3d") === -1) {
        matrix[4] = newX;
        matrix[5] = newY + ")";
      } else {
        matrix[12] = newX;
        matrix[13] = newY;
      }
      this.setState({ transform: matrix.join(",") });
    }
  }

  const panStartHandler = (e) => {
    if (e.target.closest(".oc-node")) {
      this.setState({ panning: false });
      return;
    } else {
      this.setState({ panning: true, cursor: "move" });
    }
    let lastX = 0;
    let lastY = 0;
    if (this.state.transform !== "") {
      let matrix = this.state.transform.split(",");
      if (this.state.transform.indexOf("3d") === -1) {
        lastX = parseInt(matrix[4]);
        lastY = parseInt(matrix[5]);
      } else {
        lastX = parseInt(matrix[12]);
        lastY = parseInt(matrix[13]);
      }
    }
    if (!e.targetTouches) {
      // pand on desktop
      this.startX = e.pageX - lastX;
      this.startY = e.pageY - lastY;
    } else if (e.targetTouches.length === 1) {
      // pan on mobile device
      this.startX = e.targetTouches[0].pageX - lastX;
      this.startY = e.targetTouches[0].pageY - lastY;
    } else if (e.targetTouches.length > 1) {
      return;
    }
  }

  const setChartScale = (newScale) => {
    let matrix = [];
    let targetScale = 1;
    if (this.state.transform === "") {
      this.setState({
        transform: "matrix(" + newScale + ", 0, 0, " + newScale + ", 0, 0)"
      });
    } else {
      matrix = this.state.transform.split(",");
      if (this.state.transform.indexOf("3d") === -1) {
        targetScale = Math.abs(window.parseFloat(matrix[3]) * newScale);
        if (
          targetScale > this.props.zoomoutLimit &&
          targetScale < this.props.zoominLimit
        ) {
          matrix[0] = "matrix(" + targetScale;
          matrix[3] = targetScale;
          this.setState({ transform: matrix.join(",") });
        }
      } else {
        targetScale = Math.abs(window.parseFloat(matrix[5]) * newScale);
        if (
          targetScale > this.props.zoomoutLimit &&
          targetScale < this.props.zoominLimit
        ) {
          matrix[0] = "matrix3d(" + targetScale;
          matrix[5] = targetScale;
          this.setState({ transform: matrix.join(",") });
        }
      }
    }
  };

  const zoomHandler = (e) => {
    let newScale = 1 + (e.deltaY > 0 ? -0.2 : 0.2);
    this.setChartScale(newScale);
  }

  const exportPDF = (canvas, exportFilename) => {
    const canvasWidth = Math.floor(canvas.width);
    const canvasHeight = Math.floor(canvas.height);
    const doc = canvasWidth > canvasHeight
      ? new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvasWidth, canvasHeight]
      })
      : new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvasHeight, canvasWidth]
      });
    doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0);
    doc.save(exportFilename + '.pdf');
  }

  const exportPNG = (canvas, exportFilename) => {
    const isWebkit = "WebkitAppearance" in document.documentElement.style;
    const isFf = !!window.sidebar;
    const isEdge = navigator.appName === "Microsoft Internet Explorer" || (navigator.appName === "Netscape" && navigator.appVersion.indexOf("Edge") > -1);

    if ((!isWebkit && !isFf) || isEdge) {
      window.navigator.msSaveBlob(canvas.msToBlob(), exportFilename + ".png");
    } else {
      setDataURL(canvas.toDataURL());
      setDownload(exportFilename + ".png");
      downloadButton.current.click();
    }
  }

  useImperativeHandle(ref, () => ({

    exportTo: (exportFilename, exportFileextension) => {
      exportFilename = exportFilename || "OrgChart";
      exportFileextension = exportFileextension || "png";
      setExporting(true);
      const originalScrollLeft = container.current.scrollLeft;
      container.current.scrollLeft = 0;
      const originalScrollTop = container.current.scrollTop;
      container.current.scrollTop = 0;
      html2canvas(chart.current, {
        width: chart.current.clientWidth,
        height: chart.current.clientHeight,
        onclone: function (clonedDoc) {
          clonedDoc.querySelector(".orgchart").style.background = "none";
          clonedDoc.querySelector(".orgchart").style.transform = "";
        }
      })
        .then(canvas => {
          if (exportFileextension.toLowerCase() === "pdf") {
            exportPDF(canvas, exportFilename);
          } else {
            exportPNG(canvas, exportFilename);
          }
          setExporting(false);
          container.current.scrollLeft = originalScrollLeft;
          container.current.scrollTop = originalScrollTop;
        }, () => {
          setExporting(false);
          container.current.scrollLeft = originalScrollLeft;
          container.current.scrollTop = originalScrollTop;
        });
    }

  }));

  return (
    <div ref={container}
      className={"orgchart-container " + containerClass}
      onWheel={zoom ? zoomHandler : undefined}
      onMouseUp={
        pan && panning
          ? panEndHandler
          : undefined
      }
    >
      <div
        ref={chart}
        className={"orgchart " + chartClass}
        style={{ transform: transform, cursor: cursor }}
        onMouseDown={
          pan ? panStartHandler : undefined
        }
        onMouseMove={
          pan && this.state.panning
            ? panHandler
            : undefined
        }
      >
        <ul>
          <ChartNode
            datasource={attachRel(datasource, '00')}
            nodeTemplate={nodeTemplate}
          />
        </ul>
      </div>
      <a className="oc-download-btn hidden" ref={downloadButton} href={dataURL} download={download}>&nbsp;</a>
      <div className={`oc-mask ${exporting ? "" : "hidden"}`}>
        <i className="oci oci-spinner spinner"></i>
      </div>
    </div>
  );

});

ChartContainer.propTypes = propTypes;
ChartContainer.defaultProps = defaultProps;

export default ChartContainer;
