import pptxgen from "pptxgenjs";
import fetch from "cross-fetch";
import type PptxGenJs from "pptxgenjs";
import { VisualProps, isText, isImage, isShape, SlideProps, PresentationProps } from "./nodes";

const renderColor = (color: string) => {
  if (color.charAt(0) === "#") {
    return color.substring(1).toUpperCase();
  } else {
    return color;
  }
};

const renderSlideNode = async (
  pres: PptxGenJs,
  slide: PptxGenJs.ISlide,
  node: React.ReactElement<VisualProps>
) => {
  const { x, y, w, h } = node.props.style;
  if (isText(node)) {
    const style = node.props.style;
    slide.addText(node.props.children ?? "", {
      x,
      y,
      w,
      h,
      color: style.color ? renderColor(style.color) : undefined,
      fontFace: style.fontFace,
      fontSize: style.fontSize,
      align: style.align,
      valign: style.verticalAlign,
    });
  } else if (isImage(node)) {
    const req = await fetch(node.props.url);

    let data: string;
    if ("buffer" in req) {
      // node-fetch
      const contentType = (req as any).headers.raw()["content-type"][0];
      const buffer: Buffer = await (req as any).buffer();
      data = `data:${contentType};base64,${buffer.toString("base64")}`;
    } else {
      const blob = await req.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      data = await new Promise<string>((resolve) => {
        reader.onloadend = function () {
          resolve(reader.result as string);
        };
      });
    }

    slide.addImage({
      data,
      x,
      y,
      w,
      h,
    });
  } else if (isShape(node)) {
    const style = node.props.style;
    const shapeType = pres.ShapeType[node.props.type];
    if (typeof node.props.children === "string") {
      slide.addText(node.props.children, {
        shape: shapeType,
        x,
        y,
        w,
        h,
        fill: style.backgroundColor
          ? renderColor(style.backgroundColor)
          : undefined,
      });
    } else {
      slide.addShape(shapeType, {
        x,
        y,
        w,
        h,
        fill: style.backgroundColor
          ? renderColor(style.backgroundColor)
          : undefined,
      });
    }
  }
};

const renderSlide = async (
  pres: PptxGenJs,
  slide: PptxGenJs.ISlide,
  { props }: React.ReactElement<SlideProps>
) => {
  if (props.hidden !== undefined) {
    slide.hidden = props.hidden;
  }
  if (Array.isArray(props.children)) {
    return Promise.all(
      props.children.map((slideNode) => renderSlideNode(pres, slide, slideNode))
    );
  } else {
    return renderSlideNode(pres, slide, props.children);
  }
};

export const render = async ({
  props,
}: React.ReactElement<PresentationProps>): Promise<
  any
> => {
  const pres: PptxGenJs = new pptxgen();

  if (props.layout) {
    let layout = "LAYOUT_16x9";
    if (props.layout === "16x10") {
      layout = "LAYOUT_16x10";
    } else if (props.layout === "4x3") {
      layout = "LAYOUT_4x3";
    } else if (props.layout === "wide") {
      layout = "LAYOUT_WIDE";
    }
    pres.layout = layout;
  }

  if (props.children) {
    const arr = Array.isArray(props.children)
      ? props.children
      : [props.children];
    await Promise.all(
      arr.map((slideElement) => {
        const slide = pres.addSlide();
        return renderSlide(pres, slide, slideElement);
      })
    );
  }

  return pres.write("nodebuffer");
};
