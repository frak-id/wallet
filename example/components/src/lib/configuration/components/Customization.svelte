<script lang="ts">
  import Login from "./customization/Login.svelte";
  import Activation from "./customization/Activation.svelte";
  import Dismiss from "./customization/Dismiss.svelte";
  import Css from "./customization/Css.svelte";
  import Final from "./customization/Final.svelte";
  import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "$lib/components/ui/accordion";
</script>

<div class="container">
  <Accordion type="multiple">
    <AccordionItem value="css">
      <AccordionTrigger><h2>Customization of CSS</h2></AccordionTrigger>
      <AccordionContent>
        <Css />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="login-en">
      <AccordionTrigger
        ><h2>Customization of login screen in English</h2></AccordionTrigger
      >
      <AccordionContent>
        <Login lang="en" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="login-fr">
      <AccordionTrigger
        ><h2>Customization of login screen in French</h2></AccordionTrigger
      >
      <AccordionContent>
        <Login lang="fr" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="activation-en">
      <AccordionTrigger
        ><h2>
          Customization of activation screen in English
        </h2></AccordionTrigger
      >
      <AccordionContent>
        <Activation lang="en" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="activation-fr">
      <AccordionTrigger
        ><h2>Customization of activation screen in French</h2></AccordionTrigger
      >
      <AccordionContent>
        <Activation lang="fr" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="dismiss-en">
      <AccordionTrigger
        ><h2>Customization of dismiss screen in English</h2></AccordionTrigger
      >
      <AccordionContent>
        <Dismiss lang="en" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="dismiss-fr">
      <AccordionTrigger
        ><h2>Customization of dismiss screen in French</h2></AccordionTrigger
      >
      <AccordionContent>
        <Dismiss lang="fr" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="final-en">
      <AccordionTrigger
        ><h2>Customization of final screen in English</h2></AccordionTrigger
      >
      <AccordionContent>
        <Final lang="en" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="final-fr">
      <AccordionTrigger
        ><h2>Customization of final screen in French</h2></AccordionTrigger
      >
      <AccordionContent>
        <Final lang="fr" />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</div>

<style>
  .container {
    margin: 0 auto;
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-top: 1px solid #e0e0e0;
    padding-top: 40px;
  }
</style>
